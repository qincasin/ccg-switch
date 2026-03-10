# Team Plan: Provider 健康检查（探活）

## 概述
为 CCG Switch 的 Provider 管理添加多协议健康检查功能：后端支持 Claude/Codex/Gemini 三种 API 协议的流式探活，前端提供一键批量检测、单独检测和表单内测试连通性。

## Codex 分析摘要
1. **技术可行性**: reqwest 0.12 已开启 stream feature，futures 0.3 已在依赖中，可用 `response.bytes_stream()` + `StreamExt::next()` 做真正流式读取
2. **代理复用**: 现有 `proxy/http_client.rs` 的 `get_for_provider()` 可直接用于代理感知的 HTTP client 构建
3. **认证复用**: 三种协议的认证逻辑已在 `proxy/providers/` 下实现（Claude: x-api-key + anthropic-version, Codex: Bearer, Gemini: ?key=）
4. **推荐架构**: 3 层——输入输出模型层、协议适配层（enum + match 分发）、流式判定层（首个有效 chunk）
5. **URL 安全**: 需处理 base_url 是否已含 `/v1` 的兼容问题
6. **首 chunk 判定**: 跳过 SSE keep-alive 的空白/注释行（`:` 或 `\n`），仅首个有效字节块才算成功
7. **命令设计**: `check_provider_health` 放 `provider_commands.rs`；`check_stream_connectivity` 向后兼容扩展 `app_type` 参数

## Gemini 分析摘要
1. **UX 价值**: 解决多 Provider 用户的"黑盒焦虑"，无需进入对话模式即可验证配置
2. **图标选择**: 全局操作用 `Activity`（脉搏），单体操作用 `HeartPulse`（诊断）
3. **三态展示**: operational(绿) / degraded(黄,>5000ms) / failed(红)，配合文字和响应时间
4. **组件拆分**: `HealthStatusBadge.tsx` 封装三态逻辑，`useHealthCheck.ts` hook 管理内存状态
5. **并发控制**: 批量探活限制 5 个并发，使用 Promise 队列
6. **非持久化**: 健康状态仅内存，不进 store 持久化
7. **表单测试**: 在"获取模型列表"旁增加"测试连接"按钮，内联展示结果

## 技术方案

### 后端架构
```
stream_check_service.rs（重构）
├── StreamCheckResult / ProviderHealthResult（返回结构）
├── build_request(app_type, url, api_key, model) → (url, headers, body)
│   ├── Claude: POST {base}/v1/messages, x-api-key + Bearer, {model, max_tokens:1, messages:[...], stream:true}
│   ├── Codex:  POST {base}/v1/responses, Bearer, {model, input:"Hi", stream:true}
│   └── Gemini: POST {base}/v1beta/models/{model}:streamGenerateContent?alt=sse&key={key}, {contents:[...]}
├── check_stream(url, api_key, model, app_type, proxy_config) → StreamCheckResult
│   └── wait_first_valid_chunk(response) → 跳过空白/SSE注释，首个有效chunk即成功
└── check_provider_health(provider_id) → ProviderHealthResult
    └── 自动查找 Provider → 取 app_type + url + api_key + 首个模型 → check_stream()
```

### 前端架构
```
hooks/useHealthCheck.ts（新）
├── Map<providerId, HealthStatus> 状态管理
├── checkSingle(providerId) → invoke('check_provider_health')
└── checkBatch(providerIds, concurrency=5) → Promise 队列

components/providers/HealthStatusBadge.tsx（新）
└── 三态展示: idle/checking/operational/degraded/failed

ProviderCard.tsx（修改）
├── 新增 healthStatus / onHealthCheck props
└── 底部操作栏添加 HeartPulse 按钮 + 状态徽章

ProvidersPage.tsx（修改）
├── 顶部添加「一键探活」Activity 按钮
├── useHealthCheck hook 集成
├── 卡片视图传递 healthStatus
└── 表格视图添加 Status 列

ProviderForm.tsx（修改）
└── 模型配置区添加「测试连通性」按钮（直接 invoke check_stream_connectivity）
```

### 技术决策
- **Codex 协议**: OpenAI Responses API (`/v1/responses`)
- **Gemini 认证**: `?key=` 方式（Google AI Studio 风格），与现有 proxy adapter 一致
- **降级阈值**: latency > 5000ms 判定为 degraded
- **超时**: 30s 连接超时 + 10s 首 chunk 超时
- **并发**: 前端限制 5 个并发，后端无需批量接口

## 子任务列表

### Task 1: 后端 - 多协议流式检测服务
- **类型**: 后端 (Rust)
- **文件范围**:
  - `src-tauri/src/services/stream_check_service.rs`（重构）
  - `src-tauri/src/commands/utility_commands.rs`（扩展命令签名）
  - `src-tauri/src/commands/provider_commands.rs`（新增命令）
  - `src-tauri/src/lib.rs`（注册命令）
- **依赖**: 无
- **实施步骤**:
  1. 在 `stream_check_service.rs` 中新增 `ProviderHealthResult` 结构体：
     ```rust
     pub struct ProviderHealthResult {
         pub provider_id: String,
         pub app_type: String,
         pub model: String,
         pub available: bool,
         pub latency_ms: u64,
         pub error: Option<String>,
     }
     ```
  2. 新增私有函数 `build_request(app_type, base_url, api_key, model)` 返回 `(String, HeaderMap, Value)`：
     - Claude: POST `{base}/v1/messages`，headers 加 `x-api-key` + `anthropic-version: 2023-06-01` + `Content-Type`，body `{model, max_tokens:1, messages:[{role:"user",content:"Hi"}], stream:true}`
     - Codex: POST `{base}/v1/responses`，headers 加 `Authorization: Bearer` + `Content-Type`，body `{model, input:"Hi", stream:true}`
     - Gemini: POST `{base}/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}`，headers 加 `Content-Type`，body `{contents:[{parts:[{text:"Hi"}]}]}`
     - URL 拼接：base_url 去尾斜杠，检测是否已含 `/v1` 避免重复
  3. 新增私有异步函数 `wait_first_valid_chunk(response) -> Result<u64, String>`：
     - 用 `response.bytes_stream()` + `StreamExt::next()`
     - 外层套 `tokio::time::timeout(Duration::from_secs(10), ...)`
     - 跳过空白和 SSE 注释行（以 `:` 开头或纯 `\n`）
     - 首个有效 chunk 到达即返回成功 + drop response
  4. 重构 `check_stream` 函数签名为：
     ```rust
     pub async fn check_stream(
         url: String, api_key: String, model: String,
         app_type: Option<String>,
         proxy_config: Option<ProviderProxyConfig>,
     ) -> Result<StreamCheckResult, io::Error>
     ```
     - `app_type` 默认 `"claude"` 保持向后兼容
     - 使用 `build_request` 构建请求
     - 使用 `crate::services::proxy_service` 或 `reqwest::Client::builder()` 构建代理感知 client（参考 `proxy_config`）
     - 调用 `wait_first_valid_chunk` 判定结果
  5. 新增 `check_provider_health` 函数：
     ```rust
     pub async fn check_provider_health(provider_id: String) -> Result<ProviderHealthResult, io::Error>
     ```
     - 通过 `provider_service::load_providers()` 查找 provider
     - 选择首个可用模型（按优先级 sonnet > opus > haiku > reasoning）
     - 调用 `check_stream` 并包装为 `ProviderHealthResult`
  6. 在 `utility_commands.rs` 中扩展 `check_stream_connectivity` 签名：
     ```rust
     pub async fn check_stream_connectivity(
         url: String, api_key: String, model: String,
         app_type: Option<String>,
     ) -> Result<StreamCheckResult, String>
     ```
  7. 在 `provider_commands.rs` 中新增：
     ```rust
     #[tauri::command]
     pub async fn check_provider_health(provider_id: String) -> Result<ProviderHealthResult, String> {
         stream_check_service::check_provider_health(provider_id).await.map_err(|e| e.to_string())
     }
     ```
  8. 在 `lib.rs` 的 `generate_handler!` 中注册 `provider_commands::check_provider_health`
- **验收标准**:
  - `cargo check` 通过
  - 三种 appType 各自生成正确的请求格式
  - 现有 `check_stream_connectivity` 调用不破坏（app_type=None 时走 Claude）
  - 支持 Provider 独立代理配置

### Task 2: 前端 - 健康检查 Hook 与状态组件
- **类型**: 前端 (TypeScript/React)
- **文件范围**:
  - `src/hooks/useHealthCheck.ts`（新建）
  - `src/components/providers/HealthStatusBadge.tsx`（新建）
- **依赖**: 无
- **实施步骤**:
  1. 创建 `src/hooks/useHealthCheck.ts`：
     ```typescript
     export type HealthState = 'idle' | 'checking' | 'operational' | 'degraded' | 'failed';

     export interface HealthStatus {
         state: HealthState;
         latencyMs?: number;
         error?: string;
         lastChecked?: number;
     }

     export function useHealthCheck() {
         // Map<providerId, HealthStatus>
         // checkSingle(providerId: string): Promise<void>
         //   - 设置 state='checking'
         //   - invoke('check_provider_health', { providerId })
         //   - 根据结果设置 state: available && latency<=5000 → 'operational'
         //                               available && latency>5000  → 'degraded'
         //                               !available                 → 'failed'
         // checkBatch(providerIds: string[], concurrency=5): Promise<void>
         //   - Promise 队列控制并发
         //   - 逐个完成时更新状态（实时反映）
         // isAnyChecking: boolean
         // clearAll(): void
     }
     ```
     - 并发控制：简单的 Promise 队列，维护 running 计数，空槽时取下一个
     - 状态用 `useState<Record<string, HealthStatus>>` 管理
  2. 创建 `src/components/providers/HealthStatusBadge.tsx`：
     ```typescript
     interface HealthStatusBadgeProps {
         status?: HealthStatus;
         compact?: boolean; // 紧凑模式用于卡片操作区
     }
     ```
     - `idle`: 不渲染任何内容
     - `checking`: `<Loader2 className="w-3.5 h-3.5 animate-spin text-base-content/40" />`
     - `operational`: 绿色圆点 + "正常" + `{latencyMs}ms`
     - `degraded`: 黄色圆点 + "延迟" + `{latencyMs}ms`
     - `failed`: 红色圆点 + "失败"（hover tooltip 显示 error 摘要，截取前 50 字符）
     - compact 模式只显示圆点 + 数字，无文字
- **验收标准**:
  - TypeScript 编译无错误
  - hook 正确管理状态生命周期
  - Badge 正确展示五种状态
  - 并发控制有效

### Task 3: 前端 - i18n 国际化文案
- **类型**: 前端 (JSON)
- **文件范围**:
  - `src/locales/zh.json`
  - `src/locales/en.json`
- **依赖**: 无
- **实施步骤**:
  1. 在 `zh.json` 的 `providers` 对象中添加：
     ```json
     "health_check": "一键探活",
     "health_check_single": "探活",
     "test_connectivity": "测试连通性",
     "health_checking": "检测中...",
     "health_status_operational": "正常",
     "health_status_degraded": "延迟",
     "health_status_failed": "失败",
     "health_check_batch_done": "探活完成：{{success}} 正常，{{failed}} 失败",
     "test_connectivity_success": "连接成功 ({{latency}}ms)",
     "test_connectivity_failed": "连接失败：{{error}}"
     ```
  2. 在 `en.json` 的 `providers` 对象中添加：
     ```json
     "health_check": "Health Check All",
     "health_check_single": "Check",
     "test_connectivity": "Test Connection",
     "health_checking": "Checking...",
     "health_status_operational": "OK",
     "health_status_degraded": "Slow",
     "health_status_failed": "Failed",
     "health_check_batch_done": "Check done: {{success}} OK, {{failed}} failed",
     "test_connectivity_success": "Connected ({{latency}}ms)",
     "test_connectivity_failed": "Failed: {{error}}"
     ```
- **验收标准**:
  - JSON 格式合法，无语法错误
  - 中英文 key 完全对应
  - 文案简洁准确

### Task 4: 前端 - ProviderForm 测试连通性
- **类型**: 前端 (TypeScript/React)
- **文件范围**:
  - `src/components/providers/ProviderForm.tsx`
- **依赖**: Task 3 (i18n keys)
- **实施步骤**:
  1. 新增状态变量：
     ```typescript
     const [testLoading, setTestLoading] = useState(false);
     const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);
     ```
  2. 新增 `handleTestConnectivity` 函数：
     - 检查 url 和 apiKey 是否已填，未填则 `showToast` 提示
     - 选择测试模型：取 defaultSonnetModel || defaultOpusModel || defaultHaikuModel || defaultReasoningModel || 按 appType 给默认值（claude → 'claude-sonnet-4-20250514', codex → 'gpt-4o', gemini → 'gemini-2.0-flash'）
     - 调用 `invoke('check_stream_connectivity', { url, apiKey, model, appType })`
     - 根据结果设置 testResult
  3. 在模型配置区标题行（"获取模型列表"按钮旁边）添加测试按钮：
     ```tsx
     <button
         type="button"
         onClick={handleTestConnectivity}
         disabled={testLoading || !url || !apiKey}
         className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 text-xs font-medium hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50"
     >
         {testLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HeartPulse className="w-3.5 h-3.5" />}
         {t('providers.test_connectivity')}
     </button>
     ```
  4. 在按钮下方显示测试结果（内联 badge）：
     - 成功：绿色文字 `✓ 连接成功 (245ms)`
     - 失败：红色文字 `✗ 连接失败：xxx`
  5. URL / API Key / appType 变化时清除 testResult
- **验收标准**:
  - 测试按钮在 URL+Key 填写后可用
  - 测试中有 loading 动画
  - 结果正确展示（成功/失败 + 延迟）
  - 切换 appType 或修改 URL/Key 自动清除旧结果

### Task 5: 前端 - ProviderCard 与 ProvidersPage 集成
- **类型**: 前端 (TypeScript/React)
- **文件范围**:
  - `src/components/providers/ProviderCard.tsx`
  - `src/pages/ProvidersPage.tsx`
- **依赖**: Task 2 (hook + badge), Task 3 (i18n)
- **实施步骤**:
  **ProviderCard.tsx:**
  1. 新增 props：
     ```typescript
     healthStatus?: HealthStatus;
     onHealthCheck?: (id: string) => void;
     ```
  2. 在底部操作栏的「克隆」按钮之后、「删除」按钮之前添加探活按钮：
     ```tsx
     <button
         onClick={() => onHealthCheck?.(provider.id)}
         disabled={healthStatus?.state === 'checking'}
         className="btn btn-ghost btn-xs gap-1"
         title={t('providers.health_check_single')}
     >
         {healthStatus?.state === 'checking'
             ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
             : <HeartPulse className="w-3.5 h-3.5" />}
     </button>
     ```
  3. 在 API Key 行下方（URL 上方）插入 `HealthStatusBadge`：
     ```tsx
     {healthStatus && healthStatus.state !== 'idle' && (
         <div className="mb-2">
             <HealthStatusBadge status={healthStatus} />
         </div>
     )}
     ```

  **ProvidersPage.tsx:**
  4. 导入并使用 `useHealthCheck` hook：
     ```typescript
     const { statuses, checkSingle, checkBatch, isAnyChecking } = useHealthCheck();
     ```
  5. 在顶部操作栏添加「一键探活」按钮（在「刷新」按钮之前）：
     ```tsx
     <button
         onClick={() => checkBatch(filteredProviders.map(p => p.id))}
         disabled={isAnyChecking || loading}
         className="btn bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-none btn-sm gap-2 whitespace-nowrap"
     >
         {isAnyChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
         {t('providers.health_check')}
     </button>
     ```
  6. 卡片视图：给 ProviderCard 传递 `healthStatus={statuses[provider.id]}` 和 `onHealthCheck={checkSingle}`
  7. 表格视图：在现有列之后添加「状态」列：
     - 表头：`Status`
     - 单元格：`<HealthStatusBadge status={statuses[provider.id]} compact />`
     - 操作列添加 HeartPulse 按钮
  8. 导入 `Activity`, `HeartPulse`, `Loader2` 图标
- **验收标准**:
  - 一键探活按钮点击后并发检测所有已过滤 Provider
  - 单个探活按钮独立工作
  - 状态实时更新（检测中 → 结果）
  - 表格视图同样有状态列和操作按钮
  - 不影响拖拽排序功能

## 文件冲突检查
✅ 无冲突 — 每个 Task 的文件范围完全隔离

| 文件 | Task |
|------|------|
| `src-tauri/src/services/stream_check_service.rs` | Task 1 |
| `src-tauri/src/commands/utility_commands.rs` | Task 1 |
| `src-tauri/src/commands/provider_commands.rs` | Task 1 |
| `src-tauri/src/lib.rs` | Task 1 |
| `src/hooks/useHealthCheck.ts` (新) | Task 2 |
| `src/components/providers/HealthStatusBadge.tsx` (新) | Task 2 |
| `src/locales/zh.json` | Task 3 |
| `src/locales/en.json` | Task 3 |
| `src/components/providers/ProviderForm.tsx` | Task 4 |
| `src/components/providers/ProviderCard.tsx` | Task 5 |
| `src/pages/ProvidersPage.tsx` | Task 5 |

## 并行分组
- **Layer 1 (并行, 4 Builders)**: Task 1, Task 2, Task 3, Task 4
- **Layer 2 (依赖 Layer 1)**: Task 5 (依赖 Task 2 + Task 3)
