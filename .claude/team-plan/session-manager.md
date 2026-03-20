# Team Plan: session-manager

## 概述
在 CCG Switch (Tauri 2) 中新增 `session_manager` 根级模块，实现 Claude / Codex / Gemini 三平台统一会话管理，并改造前端 WorkspacesPage 为多平台会话展示页面。

## Codex 分析摘要
Codex 分析执行失败（stdin 输入过长）。以下为 Lead 手动分析结论：

**技术可行性**：✅ 完全可行，无需新增 crate 依赖（chrono, regex, serde_json, dirs 均已在 Cargo.toml 中）。

**架构方案**：
- 新模块 `session_manager/` 与 `proxy/`, `mcp/` 同级
- Provider trait 模式：每个平台一个独立 provider 文件
- 类型命名：`SessionMeta`（避免与 dashboard_service 的 `SessionInfo` 冲突）
- 错误处理：使用 `std::io::Error`（与现有 dashboard_service 一致）
- 文件 I/O：`tauri::async_runtime::spawn_blocking` 包装

**关键约束**：
1. `lib.rs:32` 导入了 `SessionInfo, SessionMessage`，新类型必须用不同名称
2. `lib.rs:194-200` 注册了 `get_project_sessions`, `get_session_messages`，保留兼容
3. `mcp::utils` 已有 `home_dir()`, `get_codex_config_dir()` 等，新模块复用 `dirs::home_dir()` 直接调用避免跨模块依赖
4. Claude agent- 前缀文件必须过滤
5. Codex 有 `session_meta` 和 `response_item` 两种行类型
6. Gemini hash 目录不可逆推项目路径

## Gemini 分析摘要
**UI/UX 方案**：
- 保留三列布局（项目/全部 → 会话列表 → 消息详情）
- 新增"全部会话"模式入口在第一列顶部
- Provider 筛选标签（全部/Claude/Codex/Gemini）置于中间列顶部
- Provider 视觉标识：Claude 橙紫渐变、Codex 蓝青渐变、Gemini 靛粉渐变

**组件策略**：
- 在 `WorkspacesPage.tsx` 内直接改造（不拆分为独立组件文件，保持最小改动）
- 新增 `src/types/session.ts` 类型定义
- 恢复按钮使用 `session.resumeCommand`，null 时禁用

**交互要点**：
- Loading 骨架屏用 CSS pulse
- 空状态提示区分 provider 筛选
- 错误通过现有 `showToast` 处理

## 技术方案

### 后端架构
```
src-tauri/src/
├── session_manager/
│   ├── mod.rs              # SessionMeta, SessionMessage 类型 + scan_sessions() + load_messages()
│   └── providers/
│       ├── mod.rs           # pub mod claude/codex/gemini/utils
│       ├── utils.rs         # truncate_text, sanitize_text, home_dir helper
│       ├── claude.rs        # scan_claude_sessions(), load_claude_messages()
│       ├── codex.rs         # scan_codex_sessions(), load_codex_messages()
│       └── gemini.rs        # scan_gemini_sessions(), load_gemini_messages()
├── commands/
│   └── session_commands.rs  # list_sessions, get_unified_session_messages (Tauri commands)
```

### 数据模型
```rust
// session_manager/mod.rs
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub provider_id: String,        // "claude" | "codex" | "gemini"
    pub session_id: String,
    pub title: Option<String>,
    pub summary: Option<String>,
    pub project_dir: Option<String>,
    pub created_at: i64,            // 毫秒时间戳
    pub last_active_at: i64,        // 毫秒时间戳
    pub source_path: String,
    pub resume_command: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct UnifiedSessionMessage {
    pub role: String,
    pub content: String,
    pub ts: Option<String>,
}
```

### Tauri 命令
```rust
// commands/session_commands.rs
#[tauri::command]
pub async fn list_sessions() -> Result<Vec<SessionMeta>, String>

#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_unified_session_messages(providerId: String, sourcePath: String) -> Result<Vec<UnifiedSessionMessage>, String>
```

### 前端改造
- 新增 `src/types/session.ts`：`SessionMeta` 和 `UnifiedSessionMessage` 接口
- 改造 `WorkspacesPage.tsx`：
  - 新增 `viewMode` 状态 (`'project' | 'all'`)
  - 新增 `providerFilter` 状态 (`'all' | 'claude' | 'codex' | 'gemini'`)
  - "全部会话"模式调用 `list_sessions`，按 provider 筛选
  - Provider badge 区分来源
  - 恢复按钮使用 `resumeCommand`

## 子任务列表

### Task 1: Backend - Session Manager Foundation
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/session_manager/mod.rs` (新建)
  - `src-tauri/src/session_manager/providers/mod.rs` (新建)
  - `src-tauri/src/session_manager/providers/utils.rs` (新建)
- **依赖**: 无
- **实施步骤**:
  1. 创建 `session_manager/mod.rs`：定义 `SessionMeta`, `UnifiedSessionMessage` 结构体（serde rename_all camelCase），声明 `pub mod providers;`，实现 `pub fn scan_sessions() -> Vec<SessionMeta>` 和 `pub fn load_messages(provider_id: &str, source_path: &str) -> Vec<UnifiedSessionMessage>`
  2. 创建 `session_manager/providers/mod.rs`：声明 `pub mod claude; pub mod codex; pub mod gemini; pub mod utils;`
  3. 创建 `session_manager/providers/utils.rs`：从 `dashboard_service.rs` 迁移 `truncate_text()`, `sanitize_session_text()`, `extract_message_text()`, `extract_teammate_summary()`, `read_tail_text()` 函数。新增 `home_dir()` wrapper
  4. `scan_sessions()` 调用三个 provider 的扫描函数并合并排序（按 `last_active_at` 降序）
  5. `load_messages()` 根据 `provider_id` 路由到对应 provider 的解析函数
- **验收标准**: `cargo check` 通过（provider 函数可暂返回空 Vec）

### Task 2: Backend - Claude Provider
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/session_manager/providers/claude.rs` (新建)
- **依赖**: Task 1
- **实施步骤**:
  1. 实现 `pub fn scan_claude_sessions() -> Vec<SessionMeta>`：扫描 `~/.claude/projects/` 目录
  2. 遍历每个项目目录，查找 `.jsonl` 文件，过滤 `agent-` 前缀文件
  3. 从 `.jsonl` 提取 `session_id`（文件名）、`title`（首条 user 消息截断 80 字符）、`summary`（截断 140 字符）、`last_message`
  4. 从文件元数据获取 `created_at` 和 `last_active_at`（修改时间）
  5. 从 `.jsonl` 首行提取 `cwd` 字段作为 `project_dir`
  6. 生成 `resume_command`: `claude --resume {session_id}`
  7. 实现 `pub fn load_claude_messages(source_path: &str) -> Vec<UnifiedSessionMessage>`：逐行解析 `.jsonl`，提取 type=user/assistant 的消息
- **验收标准**: 能正确扫描本地 Claude 会话文件，返回非空 SessionMeta 列表

### Task 3: Backend - Codex Provider
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/session_manager/providers/codex.rs` (新建)
- **依赖**: Task 1
- **实施步骤**:
  1. 实现 `pub fn scan_codex_sessions() -> Vec<SessionMeta>`：扫描 `~/.codex/sessions/` 目录
  2. 查找 `.jsonl` 文件，用 regex 从文件名提取 UUID session_id
  3. 解析 `type: "session_meta"` 行获取 `payload.id` 和 `payload.cwd`
  4. 解析 `type: "response_item"` + `payload.type: "message"` 行获取消息内容
  5. 首条 user 消息作为 `title`（截断 80 字符）
  6. 生成 `resume_command`: `codex resume {session_id}`
  7. 实现 `pub fn load_codex_messages(source_path: &str) -> Vec<UnifiedSessionMessage>`
- **验收标准**: 能正确扫描本地 Codex 会话文件（如有），正确区分 session_meta 和 message 行

### Task 4: Backend - Gemini Provider
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/session_manager/providers/gemini.rs` (新建)
- **依赖**: Task 1
- **实施步骤**:
  1. 实现 `pub fn scan_gemini_sessions() -> Vec<SessionMeta>`：扫描 `~/.gemini/tmp/` 下所有 `<hash>/chats/session-*.json` 文件
  2. 解析 JSON 文件：提取 `sessionId`, `messages[]`, `startTime`, `lastUpdated`
  3. 从 messages 提取首条 user 消息作为 `title`
  4. `project_dir` 设为 `None`（hash 不可逆推）
  5. 生成 `resume_command`: `gemini --resume {session_id}`
  6. 实现 `pub fn load_gemini_messages(source_path: &str) -> Vec<UnifiedSessionMessage>`：解析 messages 数组
  7. 注意 Gemini 是 `.json`（非 jsonl），整个文件是单个 JSON 对象
- **验收标准**: 能正确扫描本地 Gemini 会话文件（如有），正确解析 JSON 格式

### Task 5: Backend - Command Integration & Cleanup
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/commands/session_commands.rs` (新建)
  - `src-tauri/src/commands/mod.rs` (修改：添加 `pub mod session_commands;`)
  - `src-tauri/src/lib.rs` (修改：添加 `mod session_manager;`，注册新命令，移除旧 session 命令和 import)
  - `src-tauri/src/services/dashboard_service.rs` (修改：删除 SessionInfo, SessionMessage 及所有会话相关函数约 370 行)
- **依赖**: Task 2, Task 3, Task 4
- **实施步骤**:
  1. 创建 `commands/session_commands.rs`：
     - `pub async fn list_sessions() -> Result<Vec<SessionMeta>, String>`：用 `spawn_blocking` 调用 `session_manager::scan_sessions()`
     - `pub async fn get_unified_session_messages(providerId, sourcePath) -> Result<Vec<UnifiedSessionMessage>, String>`：用 `spawn_blocking` 调用 `session_manager::load_messages()`
  2. 修改 `commands/mod.rs`：添加 `pub mod session_commands;`
  3. 修改 `lib.rs`：
     - 添加 `mod session_manager;`（顶部）
     - 添加 `use commands::session_commands;`
     - 在 `generate_handler!` 中注册 `session_commands::list_sessions`, `session_commands::get_unified_session_messages`
     - 删除 `lib.rs:32` 的 `SessionInfo, SessionMessage` import
     - 删除 `lib.rs:192-201` 的旧 `get_project_sessions`, `get_session_messages` 命令函数
     - 删除 `generate_handler!` 中的 `get_project_sessions`, `get_session_messages`
  4. 修改 `dashboard_service.rs`：
     - 删除 `SessionInfo` 结构体 (L494-505)
     - 删除 `SessionMessage` 结构体 (L791-796)
     - 删除 `get_project_sessions()` 函数 (L527-579)
     - 删除 `get_session_messages()` 函数 (L799-861)
     - 删除所有仅被上述函数使用的辅助函数：`encode_project_path`, `extract_session_hints`, `extract_last_message`, `read_tail_text`, `extract_message_text`, `extract_teammate_summary`, `sanitize_session_text`, `truncate_text`
     - 保留：`DashboardStats`, `ProjectInfo`, `HistoryEntry`, `ProjectTokenStat`, `get_claude_home`, `scan_jsonl_files`, `extract_cwd_from_project_dir` 等 Dashboard 统计功能
- **验收标准**: `cargo check` 通过，无 unused warning，旧命令已移除

### Task 6: Frontend - Types & i18n
- **类型**: 前端
- **文件范围**:
  - `src/types/session.ts` (新建)
  - `src/locales/zh.json` (修改：添加 sessions 相关 key)
  - `src/locales/en.json` (修改：添加 sessions 相关 key)
- **依赖**: 无
- **实施步骤**:
  1. 创建 `src/types/session.ts`：定义 `SessionMeta` 和 `UnifiedSessionMessage` 接口
  2. 在 `zh.json` 添加：sessions.all_sessions, sessions.filter_all, sessions.filter_claude, sessions.filter_codex, sessions.filter_gemini, sessions.no_sessions, sessions.resume_not_available, sessions.provider_claude, sessions.provider_codex, sessions.provider_gemini 等
  3. 在 `en.json` 添加对应英文翻译
- **验收标准**: TypeScript 类型无报错，翻译 key 中英文对齐

### Task 7: Frontend - WorkspacesPage Refactoring
- **类型**: 前端
- **文件范围**:
  - `src/pages/WorkspacesPage.tsx` (修改)
- **依赖**: Task 5, Task 6
- **实施步骤**:
  1. 导入 `SessionMeta`, `UnifiedSessionMessage` 类型
  2. 新增状态：`viewMode: 'project' | 'all'`，`providerFilter: 'all' | 'claude' | 'codex' | 'gemini'`，`allSessions: SessionMeta[]`
  3. 第一列顶部新增"全部会话"按钮，点击切换 `viewMode` 为 `'all'`
  4. 当 `viewMode === 'all'` 时：调用 `invoke('list_sessions')` 获取全平台会话
  5. 中间列顶部新增 Provider 筛选标签栏（pill 样式 `rounded-full`）
  6. 会话卡片新增 Provider badge（小色块 + 文字，Claude 橙色 / Codex 蓝色 / Gemini 靛色）
  7. 点击会话加载消息：`viewMode === 'all'` 时调用 `invoke('get_unified_session_messages', { providerId, sourcePath })`；`viewMode === 'project'` 时保留原逻辑
  8. 恢复按钮：使用 `session.resumeCommand ?? session.resumeCommand`，若 null 则禁用按钮
  9. 保留所有现有功能（搜索、目录浏览、TOC、消息复制等）
- **验收标准**: 页面能展示三平台会话，Provider 筛选正常，恢复按钮正确路由

## 文件冲突检查
✅ 无冲突 — 每个 Task 的文件范围完全隔离：
- Task 1: `session_manager/mod.rs`, `providers/mod.rs`, `providers/utils.rs`
- Task 2: `providers/claude.rs`
- Task 3: `providers/codex.rs`
- Task 4: `providers/gemini.rs`
- Task 5: `commands/session_commands.rs`, `commands/mod.rs`, `lib.rs`, `dashboard_service.rs`
- Task 6: `types/session.ts`, `zh.json`, `en.json`
- Task 7: `WorkspacesPage.tsx`

## 并行分组
- **Layer 1** (并行): Task 1, Task 6
- **Layer 2** (并行, 依赖 Layer 1): Task 2, Task 3, Task 4
- **Layer 3** (依赖 Layer 2): Task 5
- **Layer 4** (依赖 Layer 3 + Task 6): Task 7

## Builder 数量
- Layer 1: 2 个 Builder（1 后端 + 1 前端）
- Layer 2: 3 个 Builder（各 provider 独立）
- Layer 3: 1 个 Builder（整合）
- Layer 4: 1 个 Builder（前端改造）

最大并行度: 3 (Layer 2)
