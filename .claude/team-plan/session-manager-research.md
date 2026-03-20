# Team Research: session-manager (多AI平台会话管理)

## 增强后的需求

### 目标
在 CCG Switch (Tauri 2 + Rust + React) 中添加 `session_manager` 根级模块，实现 Claude / Codex / Gemini 三个AI平台的统一会话管理。改造现有 `dashboard_service.rs` 中的 Claude 会话功能，扩展为多平台支持。改造现有 `WorkspacesPage.tsx` 为统一会话展示页面。

### 技术约束
- **模块位置**：`src-tauri/src/session_manager/`，crate 根级模块（与 `proxy/`, `mcp/` 同级）
- **现有代码处理**：直接改造 `dashboard_service.rs` 中的会话功能，迁移到新模块
- **前端**：改造现有 `WorkspacesPage.tsx`，不创建新页面
- **终端恢复**：一并实现 `resume_command` 生成和终端启动集成
- **Tauri 命令**：暴露 `list_sessions` 和 `get_unified_session_messages` 接口

### 范围边界
- **IN**: Claude/Codex/Gemini 三个平台的会话扫描、消息解析、元数据提取、终端恢复
- **OUT**: OpenClaw/OpenCode 等其他平台（参考实现中有，但本次不做）
- **OUT**: 数据库持久化（本次纯文件系统扫描）

### 验收标准
1. `list_sessions` 能返回三个平台合并后的会话列表，按最后活跃时间排序
2. `get_unified_session_messages` 能解析指定会话的全部消息
3. WorkspacesPage 展示多平台会话，可区分来源（provider badge）
4. 会话恢复能根据 provider 生成正确的 resume 命令

---

## 约束集

### 硬约束

- [HC-1] **类型名冲突**：`dashboard_service.rs` 中已存在 `SessionInfo` 和 `SessionMessage` 类型，且被 `lib.rs:32` 的 `use services::dashboard_service::{..., SessionInfo, SessionMessage}` 导入。新模块的统一类型（`SessionMeta`, `SessionMessage`）与现有类型名冲突，**必须**：要么重命名新类型，要么迁移后删除旧类型。
  — 来源：手动分析

- [HC-2] **generate_handler! 注册**：现有 `lib.rs:700-701` 已注册 `get_project_sessions` 和 `get_session_messages` 命令。新命令 `list_sessions` / `get_unified_session_messages` 必须新增注册，**旧命令可保留兼容或逐步废弃**。
  — 来源：手动分析 `lib.rs:671-793`

- [HC-3] **路径辅助函数已存在**：`mcp::utils` 中已有 `home_dir()`, `get_codex_config_dir()`, `get_gemini_settings_path()` 等函数。新模块**必须复用或统一**这些路径函数，避免重复定义。当前存在重复：`mcp::utils` 和 `mcp::codex` 中各有一份 `get_codex_config_dir()`。
  — 来源：Grep 分析 `mcp/utils.rs:40-78`, `mcp/codex.rs:6-7`

- [HC-4] **三平台会话文件格式完全不同**：
  - **Claude**: `.jsonl` 格式，位于 `~/.claude/projects/<encoded_path>/`，字段：`sessionId`, `cwd`, `type: "user"|"assistant"`, `message.content`, `timestamp`(RFC3339), `isMeta`
  - **Codex**: `.jsonl` 格式，位于 `~/.codex/sessions/`，字段：`type: "session_meta"|"response_item"`, `payload.id/cwd/type/role/content`, `timestamp`(RFC3339)
  - **Gemini**: `.json` 格式（非 jsonl！），位于 `~/.gemini/tmp/<project_hash>/chats/session-*.json`，字段：`sessionId`, `messages[]`, `startTime`, `lastUpdated`, message `type: "gemini"|"user"`
  — 来源：参考实现 `providers/claude.rs`, `codex.rs`, `gemini.rs`

- [HC-5] **依赖已满足**：`chrono 0.4`（timestamp 解析）、`regex 1`（Codex session ID 提取）、`serde_json 1`、`dirs 5` 均已在 `Cargo.toml` 中。**无需新增 crate 依赖**。
  — 来源：`Cargo.toml:31,47`

- [HC-6] **Claude 代理会话过滤**：Claude 的 `.jsonl` 文件中，`agent-` 前缀的文件名为子代理会话，**必须过滤**以避免噪音。
  — 来源：参考实现 `providers/claude.rs:155-160`

- [HC-7] **Codex session_meta 行**：Codex `.jsonl` 中 `type: "session_meta"` 行包含 `payload.id` 和 `payload.cwd`，而消息行是 `type: "response_item"` + `payload.type: "message"`。**解析逻辑必须区分这两种行类型**。
  — 来源：参考实现 `providers/codex.rs:103-122`

- [HC-8] **Gemini 无项目目录信息**：Gemini 使用 hash 目录（`tmp/<hash>/chats/`），hash 不可逆推出项目路径。`project_dir` 字段将为 `None`。
  — 来源：参考实现 `providers/gemini.rs:111`

- [HC-9] **前端命令名 camelCase 规则**：Tauri invoke 使用 snake_case 命令名但 JS 参数名为 camelCase。Rust 端使用 `#[allow(non_snake_case)]` + camelCase 参数名。
  — 来源：参考实现 `commands/session_manager.rs:1,14-16`

- [HC-10] **spawn_blocking 必要性**：会话扫描涉及大量文件 I/O，**必须**使用 `tauri::async_runtime::spawn_blocking` 包装，避免阻塞主线程。
  — 来源：参考实现 `commands/session_manager.rs:7-8,20-24`

### 软约束

- [SC-1] **模块结构约定**：参考实现采用 `session_manager/mod.rs` + `providers/{mod,claude,codex,gemini}.rs` + `providers/utils.rs` 分层结构。推荐遵循此模式保持一致。
  — 来源：参考实现目录结构

- [SC-2] **resume_command 格式**：
  - Claude: `claude --resume {session_id}`
  - Codex: `codex resume {session_id}`
  - Gemini: `gemini --resume {session_id}`
  — 来源：参考实现各 provider

- [SC-3] **serde rename_all camelCase**：统一数据模型使用 `#[serde(rename_all = "camelCase")]` 保持前端 JSON 字段命名一致。
  — 来源：参考实现 `mod.rs:10,31`

- [SC-4] **skip_serializing_if Option**：对 Option 字段使用 `#[serde(skip_serializing_if = "Option::is_none")]` 减少 JSON 体积。
  — 来源：参考实现 `mod.rs:15-27`

- [SC-5] **前端 WorkspacesPage 已有三列布局**：项目列表 → 会话列表 → 消息详情。改造时保留此布局结构，增加"全部会话"模式（跨项目）和 provider 筛选。
  — 来源：手动分析 `WorkspacesPage.tsx`

- [SC-6] **现有终端恢复命令可复用**：`lib.rs:369-534` 的 `launch_resume_session` 已处理 Windows/macOS/Linux 多终端适配，新模块只需生成 `resume_command` 字段，前端调用现有命令。
  — 来源：手动分析 `lib.rs:369-534`

- [SC-7] **国际化**：所有用户可见文本必须加入 `zh.json` 和 `en.json`。
  — 来源：CLAUDE.md 编码规范

- [SC-8] **截断策略**：会话标题截断 80 字符，摘要截断 160 字符，最后消息截断 180 字符。
  — 来源：参考实现 `dashboard_service.rs:639,641,692`

### 依赖关系

- [DEP-1] `session_manager` → `mcp::utils`：路径辅助函数（`home_dir`, `get_codex_config_dir`）。需要将路径辅助函数提升为共享模块或直接使用 `dirs::home_dir()`。
- [DEP-2] `session_manager` → `chrono`：RFC3339 时间戳解析为毫秒。
- [DEP-3] `session_manager` → `regex`：Codex session ID 从文件名中提取 UUID 模式。
- [DEP-4] `lib.rs` → `session_manager`：Tauri 命令调用 `session_manager::scan_sessions()` 和 `session_manager::load_messages()`。
- [DEP-5] `commands/session_commands.rs`（新建）→ `session_manager`：命令层薄封装。
- [DEP-6] 前端 `WorkspacesPage.tsx` → Tauri `invoke("list_sessions")` / `invoke("get_unified_session_messages")`。
- [DEP-7] 前端 → `launch_resume_session` 现有命令（复用）。

### 风险

- [RISK-1] **大量会话扫描性能**：用户可能有数百个项目和数千个会话文件。三个平台的全量扫描可能导致首次加载延迟。
  — 缓解：使用 `spawn_blocking`，考虑分页或懒加载，可缓存结果。

- [RISK-2] **路径编码/解码**：Claude 的项目目录编码规则复杂（`C:\guodevelop\project` → `C--guodevelop-project`），且 `-` 和 `.` 都被编码为 `-`。`dashboard_service.rs` 已有 `decode_project_path` + `resolve_encoded_parts` 实现。迁移时必须保留此逻辑。
  — 缓解：将 `decode_project_path` 及相关辅助函数一并迁移到新模块的 utils 中。

- [RISK-3] **Gemini 目录结构可能因版本变化**：Gemini CLI 的 `tmp/<hash>/chats/` 结构可能在未来版本中变更。
  — 缓解：扫描逻辑容错，目录不存在时返回空数组。

- [RISK-4] **前端类型变更影响**：WorkspacesPage 当前直接使用 `SessionInfo`（Claude 格式），改为 `SessionMeta`（统一格式）后，字段名和结构会变化（如 `session_title` → `title`, `file_path` → `sourcePath`）。
  — 缓解：统一规划字段映射，一次性完成前端类型更新。

- [RISK-5] **dashboard_service 拆分影响**：`dashboard_service.rs` 是 862 行的大文件，其中会话相关功能（`SessionInfo`, `SessionMessage`, `get_project_sessions`, `get_session_messages`, 及所有辅助函数）占约 400 行。拆分需确保不影响剩余的 Dashboard 统计功能（`get_stats`, `list_projects`, `get_activity_history`, `get_project_token_stats`）。
  — 缓解：仅迁移会话相关代码，Dashboard 统计功能保持不变。Dashboard 的 `list_projects` 需要保留（工作区项目列表仍需要）。

---

## 成功判据

- [OK-1] `invoke("list_sessions")` 返回 `SessionMeta[]`，包含 Claude/Codex/Gemini 三个来源的会话，每条有 `providerId`, `sessionId`, `title`, `summary`, `projectDir`(可选), `createdAt`, `lastActiveAt`, `sourcePath`, `resumeCommand`
- [OK-2] `invoke("get_unified_session_messages", { providerId, sourcePath })` 根据 `providerId` 正确路由到对应 provider 的解析逻辑，返回统一的 `SessionMessage[]`
- [OK-3] WorkspacesPage 展示多平台会话列表，可区分 Claude/Codex/Gemini 来源（provider 标签/图标）
- [OK-4] 点击会话可加载消息详情，格式统一（role + content + ts）
- [OK-5] 点击恢复按钮，根据 `providerId` 生成正确的 resume command 并在终端中执行
- [OK-6] 编译通过 `cargo build` 和 `npm run build`，无 warning
- [OK-7] 现有 Dashboard 统计功能（项目列表、活跃度、Token 统计）不受影响

---

## 开放问题（已解决）

- Q1: 模块位置？ → A: crate 根级模块 `session_manager/` → 约束：[HC-1] ~ [SC-1]
- Q2: 现有代码处理？ → A: 直接改造，迁移会话功能到新模块 → 约束：[HC-1], [HC-2], [RISK-5]
- Q3: 前端 UI？ → A: 改造现有 WorkspacesPage，不创建新页面 → 约束：[SC-5], [RISK-4]
- Q4: 终端恢复？ → A: 一并实现，复用现有 `launch_resume_session` → 约束：[SC-2], [SC-6]

---

## 文件影响范围预估

### 新建文件
| 文件 | 说明 |
|------|------|
| `src-tauri/src/session_manager/mod.rs` | 模块入口：`SessionMeta`, `SessionMessage`, `scan_sessions()`, `load_messages()` |
| `src-tauri/src/session_manager/providers/mod.rs` | provider 子模块声明 |
| `src-tauri/src/session_manager/providers/claude.rs` | Claude 会话扫描和解析 |
| `src-tauri/src/session_manager/providers/codex.rs` | Codex 会话扫描和解析 |
| `src-tauri/src/session_manager/providers/gemini.rs` | Gemini 会话扫描和解析 |
| `src-tauri/src/session_manager/providers/utils.rs` | 共享工具函数 |
| `src-tauri/src/commands/session_commands.rs` | Tauri 命令层封装 |

### 修改文件
| 文件 | 修改内容 |
|------|----------|
| `src-tauri/src/lib.rs` | 添加 `mod session_manager;` + 注册新命令到 `generate_handler!` |
| `src-tauri/src/commands/mod.rs` | 添加 `pub mod session_commands;` |
| `src-tauri/src/services/dashboard_service.rs` | 删除会话相关类型和函数（`SessionInfo`, `SessionMessage`, `get_project_sessions`, `get_session_messages` 及辅助函数），保留 Dashboard 统计功能 |
| `src/pages/WorkspacesPage.tsx` | 改造为使用 `list_sessions` / `get_unified_session_messages`，增加 provider 筛选 |
| `src/locales/zh.json` | 添加 sessions 相关翻译 |
| `src/locales/en.json` | 添加 sessions 相关翻译 |
