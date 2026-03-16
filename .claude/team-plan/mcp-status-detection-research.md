# Team Research: MCP 服务器状态检测

## 增强后的需求

为 MCP 管理页面新增服务器运行状态检测功能：

- **目标**：在每个 MCP 服务器卡片的名称旁显示运行状态指示小圆点
- **状态分级**：五态 — online（绿色）、offline（红色）、timeout（橙色）、error（红色+提示）、unknown（灰色）
- **检测范围**：所有类型的 MCP 服务器（HTTP/SSE 通过网络请求检测，stdio 通过启动进程检测）
- **触发方式**：进入 MCP 页面时自动检测 + 手动刷新按钮
- **并发策略**：限制并发数（最多 5 个同时检测），避免资源占用
- **超时设定**：HTTP/SSE 10 秒超时，stdio 进程启动 5 秒超时

## 约束集

### 硬约束

- [HC-1] 现有 `mcp_servers` 表 schema 无运行状态字段，状态检测为即时探活，不持久化到数据库 — 来源：Codex
- [HC-2] MCP 命令当前为同步函数，新增状态检测命令需使用 `async fn` 模式（异步 HTTP 请求 + `spawn_blocking` 包裹进程调用）— 来源：Codex
- [HC-3] 已有 `reqwest 0.12` + `tokio` + `futures` 依赖，HTTP 检测无需新增 crate — 来源：Codex
- [HC-4] Windows 兼容性：stdio 进程启动必须使用 `cmd /C` + `CREATE_NO_WINDOW` 模式 — 来源：Codex
- [HC-5] 前端 `McpServerRow` 类型不含 status 字段，状态需存储在独立的 Zustand state (status map) 中，不修改 McpServerRow 结构 — 来源：Gemini
- [HC-6] 状态检测不应影响服务器列表的 `loading` 状态，需独立的 `checkingStatus` 标志 — 来源：Gemini
- [HC-7] Tauri 命令返回值统一为 `Result<T, String>` — 来源：Codex
- [HC-8] 单个检测超时：HTTP/SSE 10 秒，stdio 5 秒 — 来源：用户确认

### 软约束

- [SC-1] 参考 `tool_version_service.rs` 中 `try_get_version` 的进程检测模式 — 来源：Codex
- [SC-2] 参考 `stream_check_service.rs` 中 HTTP/SSE 连通性检测模式 — 来源：Codex
- [SC-3] 参考 `useHealthCheck.ts` 中 Provider 健康检查 Hook 的前端模式（checkBatch 并发控制）— 来源：Gemini
- [SC-4] 状态检测逻辑封装在独立服务 `mcp_status_service.rs` 中，不混入 `mcp_service.rs` — 来源：Codex
- [SC-5] 错误信息避免暴露完整命令行或环境变量 — 来源：Codex
- [SC-6] 国际化：新增 status 相关 key 到 zh.json 和 en.json — 来源：Gemini
- [SC-7] 服务器配置编辑后，自动重置该服务器状态为 unknown 并重新检测 — 来源：Gemini

### 依赖关系

- [DEP-1] `mcp_status_service.rs` → `database::dao::mcp` (McpServerRow)：需读取服务器配置获取 command/url/type
- [DEP-2] `mcp_status_service.rs` → `reqwest`：HTTP/SSE 连通性检测
- [DEP-3] `mcp_status_service.rs` → `tokio::task::spawn_blocking`：stdio 进程检测（阻塞调用）
- [DEP-4] `mcp_status_service.rs` → `mcp::validation::validate_server_spec`：检测前预校验配置有效性
- [DEP-5] `mcp_commands.rs` → `mcp_status_service.rs`：新增 `check_mcp_status` 命令
- [DEP-6] `lib.rs` → `mcp_commands::check_mcp_status`：注册到 `generate_handler!`
- [DEP-7] `useMcpStoreV2.ts` → `check_mcp_status` Tauri 命令：前端调用后端状态检测
- [DEP-8] `McpPage.tsx` → `useMcpStoreV2.ts`：读取状态 map 并渲染指示灯

### 风险

- [RISK-1] 性能风险：大量 MCP 服务器并发检测可能瞬时占用资源 — 缓解：限制并发 5 个
- [RISK-2] 阻塞风险：stdio 进程检测必须使用 `spawn_blocking` 避免阻塞 tokio — 缓解：严格遵循现有模式
- [RISK-3] 安全风险：stdio 检测执行用户配置的 command，可能有副作用 — 缓解：仅检测进程能否启动，不传递实际输入
- [RISK-4] 跨平台差异：Windows/macOS/Linux 进程启动行为不同 — 缓解：沿用 `tool_version_service` 的跨平台处理方式
- [RISK-5] 误判风险：HTTP GET/HEAD 不等于 MCP 协议可用 — 缓解：明确仅检测网络连通性，非协议级探活

## 成功判据

- [OK-1] 新增 `check_mcp_status` Tauri 命令，接受服务器 ID 列表，返回每个服务器的 `{ status, message?, latency_ms? }` 结构
- [OK-2] HTTP/SSE 类型服务器：URL 可达返回 online，超时返回 timeout，连接拒绝返回 offline，其他错误返回 error
- [OK-3] stdio 类型服务器：command 可启动返回 online，command 不存在返回 offline，启动超时返回 timeout
- [OK-4] 前端 McpServerRowCard 名称旁显示颜色正确的小圆点（绿/红/橙/灰），鼠标悬停显示状态文字
- [OK-5] 进入 MCP 页面自动触发检测，所有圆点先显示灰色，逐个变为最终颜色
- [OK-6] 刷新按钮可重新触发全量检测
- [OK-7] 全量检测在所有目标不可达的最坏情况下，5 秒 * ceil(N/5) 内完成（N 为服务器数量）
- [OK-8] 编译通过，无新增 warning

## 开放问题（已解决）

- Q1: 检测哪种类型？ → A: 所有类型（HTTP + stdio）→ 约束：[HC-2], [HC-3]
- Q2: 触发方式？ → A: 页面加载自动检测 + 手动刷新 → 约束：[OK-5], [OK-6]
- Q3: 展示位置？ → A: 名称旁小圆点 → 约束：[OK-4]
- Q4: 状态粒度？ → A: 五态（online/offline/timeout/error/unknown）→ 约束：[OK-2], [OK-3]
- Q5: 超时时间？ → A: HTTP/SSE 10s, stdio 5s → 约束：[HC-8]
- Q6: 并发策略？ → A: 限制 5 并发 → 约束：[RISK-1]
- Q7: 是否持久化？ → A: 不持久化，即时探活 → 约束：[HC-1]

## 参考文件

| 文件 | 作用 |
|------|------|
| `src-tauri/src/services/stream_check_service.rs` | HTTP/SSE 检测参考 |
| `src-tauri/src/services/tool_version_service.rs` | 进程启动检测参考 |
| `src/hooks/useHealthCheck.ts` | 前端健康检查 Hook 参考 |
| `src-tauri/src/commands/mcp_commands.rs` | 命令注册位置 |
| `src-tauri/src/services/mcp_service.rs` | MCP 服务层 |
| `src/pages/McpPage.tsx` | 前端页面入口 |
| `src/stores/useMcpStoreV2.ts` | 状态管理 |
| `src/types/mcpV2.ts` | 类型定义 |
