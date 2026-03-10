# Team Research: Provider 健康检查（探活）功能

## 增强后的需求

### 目标
为 CCG Switch 的 Provider 管理页面添加完整的健康检查（探活）功能，验证 Provider 配置的 API 端点是否可用。

### 功能拆分

1. **Provider 列表页（ProvidersPage）**
   - 顶部添加「一键探活」按钮，批量检测当前过滤结果中的所有 Provider
   - 每个 Provider 卡片/行添加单独的「探活」按钮
   - 健康状态可视化展示（正常/降级/失败 三态 + 响应时间）

2. **Provider 添加/编辑表单（ProviderForm）**
   - 填写 URL + API Key 后即可进行模型测试
   - 可选带模型名称测试（使用表单中已填写的模型字段）
   - 无需保存即可测试

3. **后端健康检查服务**
   - 多协议支持：根据 Provider 的 appType 自动选择对应协议
     - Claude: Messages API (`/v1/messages?beta=true`, stream=true)
     - Codex: Responses API (`/responses`, stream=true)
     - Gemini: GenerateContent (`/v1beta/models/{model}:streamGenerateContent?alt=sse`)
   - 流式检查：只需接收首个 chunk 即判定成功
   - 支持超时、重试、降级阈值

### 验收标准
- [ ] 一键探活按钮可并发检测当前过滤的所有 Provider
- [ ] 每个 Provider 卡片/表格行有独立探活按钮
- [ ] ProviderForm 中 URL+Key 填写后可测试连通性
- [ ] 三种 appType (Claude/Codex/Gemini) 各自用正确的 API 协议
- [ ] 健康状态三态显示：operational(绿) / degraded(黄) / failed(红)
- [ ] 显示响应时间 (ms)
- [ ] 检测中有 loading 动画
- [ ] 错误信息友好展示
- [ ] 不阻塞其他 UI 操作

---

## 约束集

### 硬约束

- [HC-1] **JSON 文件存储，非数据库** — Provider 数据存储在 `~/.ci/claude_switch.json` 和 `providers.json`，通过 `provider_service.rs` 的 `load_providers()` / `save_providers()` 读写。健康检查不可引入数据库依赖。 — 来源：代码分析 `src-tauri/src/services/provider_service.rs:15-30`

- [HC-2] **Provider 结构体字段名 camelCase 序列化** — Rust 端使用 snake_case，通过 `#[serde(rename = "camelCase")]` 映射。新增字段必须遵循此模式。 — 来源：代码分析 `src-tauri/src/models/provider.rs:31-67`

- [HC-3] **Tauri 命令必须在 lib.rs generate_handler! 注册** — 所有新增 Tauri 命令必须在 `src-tauri/src/lib.rs:365-468` 的 `generate_handler!` 宏中注册。 — 来源：代码分析 `src-tauri/src/lib.rs`

- [HC-4] **前端 toast 使用 showToast()** — 项目自定义 toast 系统，不使用第三方库（sonner 等）。调用方式：`showToast(message, 'success'|'error'|'warning')`。 — 来源：代码分析 `src/components/common/ToastContainer.tsx`

- [HC-5] **图标使用 lucide-react** — 项目统一使用 lucide-react 图标库，不引入其他图标库。 — 来源：代码分析，所有组件 import 一致

- [HC-6] **UI 框架 DaisyUI 4 + TailwindCSS 3** — 按钮使用 `btn` 组件，不使用 shadcn/ui 的 Button。颜色使用 DaisyUI 主题变量或 TailwindCSS 直接色值。 — 来源：代码分析 `ProviderCard.tsx`, `ProvidersPage.tsx`

- [HC-7] **i18n 双语支持** — 新增文案必须同时更新 `src/locales/zh.json` 和 `src/locales/en.json`。使用 `useTranslation()` hook。 — 来源：CLAUDE.md 规范

- [HC-8] **appType 三种可见类型** — 前端可见的 `VISIBLE_APP_TYPES` 为 `['claude', 'codex', 'gemini']`，必须为这三种各实现对应的 API 协议。 — 来源：代码分析 `src/types/app.ts:6`

- [HC-9] **reqwest HTTP 客户端** — 后端使用 reqwest 0.12，支持 async，已有代理配置能力（`ProviderProxyConfig`）。流式读取需要 `futures::StreamExt`。 — 来源：代码分析 `src-tauri/Cargo.toml`, `stream_check_service.rs`

- [HC-10] **表单中测试使用临时参数** — ProviderForm 中测试不经过后端 Provider 存储，直接传 URL + API Key + Model 参数调用后端测试命令。现有 `check_stream_connectivity(url, api_key, model)` 命令可复用但需扩展为多协议。 — 来源：用户确认 + 代码分析 `utility_commands.rs:36-38`

### 软约束

- [SC-1] **卡片操作按钮紧凑排列** — ProviderCard 的操作区使用 `btn btn-xs btn-ghost` 风格，图标大小 `w-3.5 h-3.5`。新增探活按钮应保持一致。 — 来源：代码分析 `src/components/providers/ProviderCard.tsx:98-120`

- [SC-2] **表格操作列 `sticky right-0`** — 表格视图的操作列固定在右侧，宽度 `w-40`，按钮用 `btn-xs`。 — 来源：代码分析 `src/pages/ProvidersPage.tsx:531-553`

- [SC-3] **状态管理用 Zustand store** — Provider 相关状态集中在 `useProviderStore`。健康检查状态建议使用独立 hook（非 store），因为是临时状态不需持久化。 — 来源：代码分析 `src/stores/useProviderStore.ts`, 用户确认仅内存

- [SC-4] **页面顶部操作栏结构** — ProvidersPage 顶部有「添加 Provider」按钮和搜索/过滤栏。一键探活按钮应放在搜索栏左侧或操作按钮区域。 — 来源：代码分析 `src/pages/ProvidersPage.tsx:295-332`

- [SC-5] **ProviderForm 中模型配置区已有「获取模型」按钮** — 位于模型配置标题右侧，使用蓝色边框按钮风格。测试按钮可参考此位置和风格。 — 来源：代码分析 `src/components/providers/ProviderForm.tsx:398-424`

- [SC-6] **参考项目认证策略差异化** — 参考项目 cc-switch 在 Claude 请求中区分 `AuthStrategy::Anthropic`（加 x-api-key header）和 `AuthStrategy::Bearer`（仅 Authorization header）。当前项目可简化为统一 Bearer + x-api-key 双发。 — 来源：代码分析 `cc-switch/stream_check.rs:310-322`

- [SC-7] **拖拽排序不受影响** — ProviderCard 和 ProvidersPage 有 pointer drag 排序功能，探活按钮不应与拖拽事件冲突。 — 来源：代码分析 `ProvidersPage.tsx` drag handlers

- [SC-8] **错误处理返回 Result<T, String>** — Tauri 命令统一返回 `Result<T, String>`，错误通过 `.map_err(|e| e.to_string())` 转换。 — 来源：代码分析 `utility_commands.rs`

### 依赖关系

- [DEP-1] **ProviderForm 测试 → 现有 check_stream_connectivity 命令**：表单中的模型测试可复用现有命令，但需扩展为接受 appType 参数以支持多协议。 `utility_commands.rs:36` → `stream_check_service.rs`

- [DEP-2] **批量探活 → Provider 列表数据**：一键探活依赖 `useProviderStore` 中已加载的 providers 数据和当前过滤条件。`ProvidersPage.tsx:filteredProviders` → `useProviderStore.providers`

- [DEP-3] **多协议检测 → Provider.appType**：后端需根据 `appType` 字段路由到对应的 API 协议处理器。`stream_check_service.rs` → `models/provider.rs:AppType`

- [DEP-4] **代理支持 → ProviderProxyConfig**：如果 Provider 配置了单独代理，检测时应使用该代理。`stream_check_service.rs` → `models/provider.rs:proxy_config`

- [DEP-5] **Cargo.toml → futures crate**：流式读取需要 `futures` crate 的 `StreamExt`。需检查是否已在依赖中。

### 风险

- [RISK-1] **并发请求压力** — 一键探活可能同时发起大量 HTTP 请求（用户可能有几十个 Provider）。缓解：前端限制并发数（如 5 个），使用 Promise 池控制。

- [RISK-2] **超时配置** — 不同网络环境下合理的超时时间差异大。缓解：默认 30s，后续可考虑用户配置。

- [RISK-3] **API Key 消耗** — 每次探活会消耗少量 token（发送一条消息接收首个 chunk）。缓解：使用最小 max_tokens=1，提示词尽量短。

- [RISK-4] **Codex/Gemini 协议兼容性** — 不同中转服务商可能不完全兼容原生 API 格式。缓解：添加错误信息展示，让用户知道具体失败原因。

---

## 成功判据

- [OK-1] ProvidersPage 顶部出现「一键探活」按钮，点击后当前过滤列表中的所有 Provider 逐个或并发检测，结果在 UI 上实时更新
- [OK-2] 每个 ProviderCard（卡片视图）和表格行有独立的探活按钮，点击后该 Provider 进入检测状态（loading 动画），完成后显示状态（绿/黄/红 + 响应时间）
- [OK-3] ProviderForm 中填写 URL + API Key 后，模型配置区域或表单内出现「测试连通性」按钮，点击后使用表单中的值进行测试
- [OK-4] Claude 类型 Provider 使用 Messages API 检测，Codex 使用 Responses API，Gemini 使用 GenerateContent API
- [OK-5] 健康状态展示三态：operational(绿色圆点+文字+响应时间) / degraded(黄色) / failed(红色+错误信息)
- [OK-6] 检测过程中有 Loader 动画，不阻塞页面其他操作
- [OK-7] 所有新增文案有中英双语支持
- [OK-8] `cargo check` 通过，TypeScript 编译无错误

## 开放问题（已解决）

- Q1: 一键探活检测范围？ → A: 当前过滤结果（filteredProviders） → 约束：[HC-N/A, 功能边界]
- Q2: 表单中测试时机？ → A: 填写 URL+Key 即可测试，无需保存 → 约束：[HC-10]
- Q3: 结果持久化？ → A: 仅内存状态 → 约束：[SC-3]
- Q4: 多协议支持？ → A: 是，根据 appType 自动选择协议 → 约束：[HC-8]

## 现有代码关键参考点

| 文件 | 行号 | 说明 |
|------|------|------|
| `src-tauri/src/services/stream_check_service.rs` | 全文 | 现有基础 stream check，仅 Claude 协议，需重构为多协议 |
| `src-tauri/src/commands/utility_commands.rs` | 36-38 | 现有 `check_stream_connectivity` 命令 |
| `src-tauri/src/models/provider.rs` | 31-67 | Provider 结构体定义 |
| `src-tauri/src/services/provider_service.rs` | 全文 | Provider CRUD + JSON 文件读写 |
| `src-tauri/src/lib.rs` | 365-468 | 命令注册入口 |
| `src/pages/ProvidersPage.tsx` | 295-560 | Provider 列表页 UI |
| `src/components/providers/ProviderCard.tsx` | 38-120 | Provider 卡片组件 |
| `src/components/providers/ProviderForm.tsx` | 290-595 | Provider 表单组件 |
| `src/stores/useProviderStore.ts` | 全文 | Provider Zustand store |
| `src/types/provider.ts` | 21-43 | Provider TypeScript 类型 |

## 参考项目关键参考点

| 文件 | 说明 |
|------|------|
| `cc-switch/src-tauri/src/services/stream_check.rs` | 完整多协议 StreamCheckService 实现（Claude/Codex/Gemini），含重试、降级判定 |
| `cc-switch/src/lib/api/model-test.ts` | 前端 API 类型定义和调用封装 |
| `cc-switch/src/hooks/useStreamCheck.ts` | 健康检查 React hook |
| `cc-switch/src/components/providers/HealthStatusIndicator.tsx` | 三态健康状态指示器组件 |
| `cc-switch/src/components/usage/ModelTestConfigPanel.tsx` | 模型测试全局配置面板（高级功能，可后续添加） |
