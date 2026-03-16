# Team Plan: MCP 服务器状态检测

## 概述

为 MCP 管理页面新增服务器运行状态检测功能，在每个服务器卡片名称旁显示五态指示灯（online/offline/timeout/error/unknown），支持页面加载自动检测和手动刷新。

## Codex 分析摘要

- 后端已有完整的健康检测参考模式：`stream_check_service.rs`（HTTP 检测）+ `tool_version_service.rs`（进程检测）
- 已有 `reqwest 0.12` + `tokio` + `futures` 依赖，无需新增 crate
- 进程检测需用 `tokio::task::spawn_blocking`，Windows 需 `cmd /C` + `CREATE_NO_WINDOW`
- 新服务应封装在独立的 `mcp_status_service.rs` 中
- Tauri 命令统一返回 `Result<T, String>`

## Gemini 分析摘要

- 前端已有完整的健康检测参考模式：`useHealthCheck.ts`（并发控制 checkBatch）+ `HealthStatusBadge.tsx`（状态指示灯组件）
- 状态不应存储在 `McpServerRow` 中，而是使用独立的 status map 在 store 中管理
- 需要独立的 `checkingStatus` 标志，不影响列表 `loading` 状态
- 参考 `HealthStatusBadge.tsx` 的 UI 模式：绿色/黄色/红色小圆点 + 文字

## 技术方案

### 后端

1. **新建 `mcp_status_service.rs`**：
   - 定义 `McpStatusResult` 结构体（server_id, status, message, latency_ms）
   - `check_single_mcp_status(config: &Value) -> McpStatusResult`：根据 type 分发检测
   - HTTP/SSE：用 `reqwest::Client` 发 GET 请求，10s 超时
   - stdio：用 `spawn_blocking` + `std::process::Command` 启动进程，5s 超时

2. **新增 Tauri 命令 `check_mcp_status`**：
   - 接受 `server_ids: Vec<String>`，从 DB 读取配置
   - 用 `futures::stream::iter` + `buffer_unordered(5)` 并发检测
   - 返回 `Vec<McpStatusResult>`

### 前端

1. **扩展类型定义**：`McpStatusState` 枚举 + `McpStatusResult` 接口
2. **扩展 Store**：在 `useMcpStoreV2` 中新增 `statusMap` + `checkingStatus` + `checkAllStatus()` + `checkSingleStatus()`
3. **更新 UI**：`McpServerRowCard` 名称旁增加状态小圆点，`McpPage` 中 `useEffect` 自动检测

## 子任务列表

### Task 1: 后端状态检测服务

- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/services/mcp_status_service.rs` (新建)
- **依赖**: 无
- **实施步骤**:
  1. 创建 `src-tauri/src/services/mcp_status_service.rs`
  2. 定义状态枚举和结果结构体：
     ```rust
     #[derive(Debug, Clone, Serialize, Deserialize)]
     #[serde(rename_all = "lowercase")]
     pub enum McpStatus {
         Online,
         Offline,
         Timeout,
         Error,
         Unknown,
     }

     #[derive(Debug, Clone, Serialize, Deserialize)]
     #[serde(rename_all = "camelCase")]
     pub struct McpStatusResult {
         pub server_id: String,
         pub status: McpStatus,
         pub message: Option<String>,
         pub latency_ms: Option<u64>,
     }
     ```
  3. 实现 `check_single(server_id: &str, config: &serde_json::Value) -> McpStatusResult`：
     - 解析 config 中的 `type` 字段（默认 stdio）
     - 若 type 为 http 或 sse：调用 `check_http(url, timeout=10s)` — 使用 `reqwest::Client` 发 GET 请求
       - 2xx → online
       - 连接拒绝 → offline
       - 超时 → timeout
       - 其他 → error + 简明错误消息
     - 若 type 为 stdio：调用 `check_stdio(command, args, env, timeout=5s)` — 使用 `spawn_blocking` + `std::process::Command`
       - Windows: `cmd /C <command>` + `CREATE_NO_WINDOW`
       - macOS/Linux: `sh -c <command>`
       - 进程启动成功（exit code 任意均可）→ online
       - 命令不存在 → offline
       - 超时 → timeout
       - 其他错误 → error
  4. 实现 `check_batch(db: &Arc<Database>, server_ids: Vec<String>) -> Vec<McpStatusResult>`：
     - 从 DB 读取 `McpServerRow` 列表
     - 使用 `futures::stream::iter()` + `.buffer_unordered(5)` 并发执行
     - 不存在的 server_id 返回 status=unknown
  5. 记录延迟 `latency_ms`（从发起请求到收到响应的耗时）
- **验收标准**:
  - 文件编译通过
  - HTTP 检测：URL 可达返回 online，不可达返回 offline/timeout/error
  - stdio 检测：命令存在返回 online，不存在返回 offline
  - 并发数不超过 5

### Task 2: 国际化文案

- **类型**: 前端
- **文件范围**:
  - `src/locales/zh.json`
  - `src/locales/en.json`
- **依赖**: 无
- **实施步骤**:
  1. 在 `zh.json` 的 `mcp` 命名空间下新增：
     ```json
     "status_online": "在线",
     "status_offline": "离线",
     "status_timeout": "超时",
     "status_error": "错误",
     "status_unknown": "未知",
     "status_checking": "检测中...",
     "check_status": "检测状态",
     "check_all_status": "检测所有状态"
     ```
  2. 在 `en.json` 的 `mcp` 命名空间下新增：
     ```json
     "status_online": "Online",
     "status_offline": "Offline",
     "status_timeout": "Timeout",
     "status_error": "Error",
     "status_unknown": "Unknown",
     "status_checking": "Checking...",
     "check_status": "Check Status",
     "check_all_status": "Check All Status"
     ```
- **验收标准**:
  - JSON 格式合法
  - 中英文 key 一一对应

### Task 3: 后端命令注册

- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/commands/mcp_commands.rs`
  - `src-tauri/src/services/mod.rs`
  - `src-tauri/src/lib.rs`
- **依赖**: Task 1
- **实施步骤**:
  1. 在 `src-tauri/src/services/mod.rs` 中添加：
     ```rust
     pub mod mcp_status_service;
     ```
  2. 在 `src-tauri/src/commands/mcp_commands.rs` 中添加异步命令：
     ```rust
     #[tauri::command]
     pub async fn check_mcp_status(
         state: State<'_, AppState>,
         server_ids: Vec<String>,
     ) -> Result<Vec<McpStatusResult>, String> {
         mcp_status_service::check_batch(&state.db, server_ids).await
     }
     ```
     需导入 `use crate::services::mcp_status_service::{self, McpStatusResult};`
  3. 在 `src-tauri/src/lib.rs` 的 `generate_handler!` 中添加：
     ```rust
     mcp_commands::check_mcp_status,
     ```
     放在现有 MCP 命令之后（`mcp_commands::import_mcp_from_apps` 后面）
- **验收标准**:
  - `cargo build` 编译通过
  - 命令已注册，前端可调用 `invoke('check_mcp_status', { serverIds: [...] })`

### Task 4: 前端状态集成

- **类型**: 前端
- **文件范围**:
  - `src/types/mcpV2.ts`
  - `src/stores/useMcpStoreV2.ts`
  - `src/pages/McpPage.tsx`
- **依赖**: Task 2, Task 3
- **实施步骤**:
  1. **扩展类型** — 在 `src/types/mcpV2.ts` 末尾新增：
     ```typescript
     // MCP 服务器状态检测
     export type McpStatus = 'online' | 'offline' | 'timeout' | 'error' | 'unknown';

     export interface McpStatusResult {
         serverId: string;
         status: McpStatus;
         message?: string;
         latencyMs?: number;
     }
     ```

  2. **扩展 Store** — 在 `src/stores/useMcpStoreV2.ts` 中：
     - 新增 state 字段：
       ```typescript
       statusMap: Record<string, McpStatusResult>;
       checkingStatus: boolean;
       ```
     - 新增 action `checkAllStatus`：
       ```typescript
       checkAllStatus: async () => {
           const { servers } = get();
           if (servers.length === 0) return;
           set({ checkingStatus: true });
           try {
               const ids = servers.map(s => s.id);
               const results = await invoke<McpStatusResult[]>('check_mcp_status', { serverIds: ids });
               const map: Record<string, McpStatusResult> = {};
               for (const r of results) {
                   map[r.serverId] = r;
               }
               set({ statusMap: map, checkingStatus: false });
           } catch {
               set({ checkingStatus: false });
           }
       }
       ```
     - 新增 action `resetStatus`：
       ```typescript
       resetStatus: (serverId: string) => {
           set(prev => {
               const next = { ...prev.statusMap };
               delete next[serverId];
               return { statusMap: next };
           });
       }
       ```
     - 修改 `upsertServer`：保存成功后调用 `get().resetStatus(server.id)` 重置该服务器状态

  3. **更新 McpServerRowCard** — 在 `src/pages/McpPage.tsx` 中：
     - 给 `McpServerRowCard` 组件增加 `status` prop
     - 在服务器名称 `<h3>` 左侧添加状态指示灯：
       ```tsx
       {/* 状态指示灯 */}
       {status ? (
           <span
               className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                   status.status === 'online' ? 'bg-green-500' :
                   status.status === 'offline' ? 'bg-red-500' :
                   status.status === 'timeout' ? 'bg-orange-400' :
                   status.status === 'error' ? 'bg-red-500' :
                   'bg-gray-400'
               }`}
               title={t(`mcp.status_${status.status}`) + (status.message ? `: ${status.message}` : '') + (status.latencyMs ? ` (${status.latencyMs}ms)` : '')}
           />
       ) : (
           <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0 animate-pulse" title={t('mcp.status_checking')} />
       )}
       ```
     - `checkingStatus` 为 true 时，未返回结果的服务器圆点显示灰色 + `animate-pulse`

  4. **自动检测** — 在 `McpPage` 组件中：
     - 从 store 解构 `statusMap`, `checkingStatus`, `checkAllStatus`
     - 在 `useEffect` 中 `loadServers()` 完成后自动调用 `checkAllStatus()`：
       ```typescript
       useEffect(() => {
           loadServers().then(() => checkAllStatus());
       }, []);
       ```
     - 刷新按钮点击也触发 `checkAllStatus()`
     - 将 `statusMap[server.id]` 传递给每个 `McpServerRowCard` 的 `status` prop

- **验收标准**:
  - 进入 MCP 页面后，所有服务器卡片名称旁出现状态圆点
  - 圆点颜色正确：绿色(online)、红色(offline/error)、橙色(timeout)、灰色(unknown/checking)
  - 鼠标悬停圆点显示状态文字和延迟信息
  - 刷新按钮点击后重新检测
  - 编辑服务器后对应状态重置
  - 编译通过，无新增 warning

## 文件冲突检查

| Task | 文件 | 操作 | 冲突 |
|------|------|------|------|
| Task 1 | `mcp_status_service.rs` | 新建 | 无 |
| Task 2 | `zh.json`, `en.json` | 修改（追加 key） | 无 |
| Task 3 | `mcp_commands.rs`, `services/mod.rs`, `lib.rs` | 修改（添加行） | 无 |
| Task 4 | `mcpV2.ts`, `useMcpStoreV2.ts`, `McpPage.tsx` | 修改 | 无 |

✅ 无冲突 — 所有文件范围隔离

## 并行分组

```
Layer 1 (并行): Task 1, Task 2
Layer 2 (依赖 Task 1): Task 3
Layer 3 (依赖 Task 2 + Task 3): Task 4
```

## Builder 分配建议

- **Builder 1 (后端)**: Task 1 → Task 3（串行）
- **Builder 2 (前端)**: Task 2 → Task 4（串行）
- 最大并行度：2 个 Builder
