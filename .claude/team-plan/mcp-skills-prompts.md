# Team Plan: MCP / Skills / Prompts 功能完善

## 概述

为 claude-switch-1.0 补全三大功能：Codex MCP TOML 支持、Skills 默认仓库初始化 + 仓库管理 UI、Prompts 系统重构（DB + per-app + live 文件同步）。

## Codex 分析摘要

- MCP Codex (TOML)：可行性高，难度中。核心挑战是 JSON ↔ TOML 值转换与兼容保真。写入策略：只替换 `[mcp_servers]` 子树，保留其他根配置，原子写 + rename。解析失败时不覆盖原文件。
- Skills 默认仓库：可行性很高，难度低。建议 `INSERT OR IGNORE` 避免覆盖用户自定义 branch/enabled。
- Prompts 重构：可行性高，难度高。DB 设为 SSOT，实现回填保护 + 启用事务化。启用流程：读 live 文件 → 回填旧 prompt → disable_all → enable 目标 → 写 live 文件。
- 关键风险：Prompts 启用唯一性冲突、live 文件外部修改漂移、Codex TOML 解析失败误覆盖。
- 建议独立 3 个常量 `['claude','codex','gemini']`，不复用全局 `APP_TYPES`（含 opencode/openclaw）。

## Gemini 分析摘要

- PromptsPage：使用 DaisyUI `tabs-lg tabs-boxed` 做三应用 tab 切换，PromptCardV2 组件展示启用状态、编辑/删除按钮。空状态引导用户导入或创建。
- SkillsPage：新增 RepoManager tab，列表显示仓库 owner/name/branch/enabled，支持添加/删除。
- MCP：现有 McpPage 已有 Codex toggle（enabled_codex 字段），无需前端改动，只需后端落盘。
- Store 设计：新增 `usePromptStoreV2`，state 包含 prompts/loading/liveContent，actions 对应 7 个 Tauri 命令。
- 组件拆分：PromptTabHeader、PromptCardV2、PromptImportAction、RepoManager、AddRepoModal。

## 技术方案

### 后端方案（以 Codex 分析为准）

1. **Codex MCP**：新增 `mcp/codex.rs`，实现 TOML 读写 + JSON↔TOML 转换。`Null` 丢弃，`Datetime` 映射 RFC3339 字符串，解析失败终止写入。集成到 `mcp_service.rs` 和 `import.rs`。
2. **Skills 默认仓库**：`Database::init()` 中调用 `init_default_skill_repos()`，使用 `INSERT OR IGNORE` 幂等插入。
3. **Prompts DB 化**：新增 `prompts` 表（复合主键 `id, app_type`），DAO + Service + Commands 全套。服务层实现启用回填保护流程。

### 前端方案（以 Gemini 分析为准）

1. **PromptsPage**：per-app tab（Claude/Codex/Gemini），PromptCard 展示启用状态，底部"从文件导入"按钮。保留旧版"本地文件"tab 兼容。
2. **SkillsPage**：新增"仓库管理"tab，复用 `useSkillStoreV2` 已有的 `loadRepos/saveRepo/deleteRepo`。
3. **McpPage**：无需前端修改（已支持 Codex toggle）。

## 子任务列表

### Task 1: 添加 toml 依赖到 Cargo.toml
- **类型**: 后端
- **文件范围**: `src-tauri/Cargo.toml`
- **依赖**: 无
- **实施步骤**:
  1. 在 `[dependencies]` 末尾添加 `toml = "0.8"`
- **验收标准**: `cargo check` 通过，toml crate 可用

### Task 2: 数据库 schema 添加 prompts 表
- **类型**: 后端
- **文件范围**: `src-tauri/src/database/schema.rs`
- **依赖**: 无
- **实施步骤**:
  1. 在 `create_tables()` 的 `execute_batch` 中添加 `CREATE TABLE IF NOT EXISTS prompts` 建表语句
  2. 字段：`id TEXT, app_type TEXT, name TEXT, content TEXT, description TEXT, enabled INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER`
  3. 主键：`PRIMARY KEY (id, app_type)`
- **验收标准**: 数据库初始化后 prompts 表存在

### Task 3: Skills 默认仓库初始化
- **类型**: 后端
- **文件范围**: `src-tauri/src/database/mod.rs`
- **依赖**: 无
- **实施步骤**:
  1. 在 `Database` impl 中添加 `fn init_default_skill_repos(&self) -> Result<(), String>`
  2. 检查 `skill_repos` 表是否为空，为空则插入 4 个默认仓库（anthropics/skills, ComposioHQ/awesome-claude-skills, cexll/myclaude, JimLiu/baoyu-skills）
  3. 在 `init()` 方法的 `create_tables()` 调用之后调用 `init_default_skill_repos()`
- **验收标准**: 空数据库首次启动自动出现 4 个仓库；再次启动不重复插入

### Task 4: 实现 mcp/codex.rs (TOML 读写)
- **类型**: 后端
- **文件范围**: `src-tauri/src/mcp/codex.rs` (新建), `src-tauri/src/mcp/mod.rs`
- **依赖**: Task 1
- **实施步骤**:
  1. 创建 `src-tauri/src/mcp/codex.rs`，参考 `claude.rs` (94行) 和 `gemini.rs` (85行) 的模式
  2. 实现 `get_codex_mcp_toml_path() -> Option<PathBuf>`（路径 `~/.codex/mcp.toml`）
  3. 实现 JSON ↔ TOML 值转换辅助函数：`json_to_toml_value()` 和 `toml_to_json_value()`
  4. 实现 `read_mcp_servers() -> HashMap<String, Value>`：解析 `[mcp_servers]` section
  5. 实现 `write_mcp_servers()`：只替换 `mcp_servers` 子树，保留其他根配置，原子写
  6. 实现公开接口：`sync_server_to_codex()`, `remove_server_from_codex()`, `read_codex_mcp_for_import()`
  7. 在 `mcp/mod.rs` 中添加 `pub mod codex;` 和 `pub use codex::{sync_server_to_codex, remove_server_from_codex};`
- **验收标准**:
  - 能正确读写 `~/.codex/mcp.toml` 中的 `[mcp_servers.xxx]` section
  - TOML 格式正确，保留非 mcp_servers 的其他配置
  - JSON 值（Object/Array/String/Bool/Number）正确转换为 TOML

### Task 5: 实现 database/dao/prompts.rs (Prompt DAO)
- **类型**: 后端
- **文件范围**: `src-tauri/src/database/dao/prompts.rs` (新建), `src-tauri/src/database/dao/mod.rs`
- **依赖**: Task 2
- **实施步骤**:
  1. 创建 `src-tauri/src/database/dao/prompts.rs`
  2. 定义 `PromptRow` 结构体：`id, app_type, name, content, description, enabled, created_at, updated_at`，使用 `#[serde(rename_all = "camelCase")]`
  3. 实现 Database 方法：
     - `get_prompts_by_app(app_type: &str) -> Result<Vec<PromptRow>, String>`
     - `save_prompt(prompt: &PromptRow) -> Result<(), String>`（INSERT OR REPLACE）
     - `delete_prompt(id: &str, app_type: &str) -> Result<bool, String>`
     - `disable_all_prompts(app_type: &str) -> Result<(), String>`
     - `set_prompt_enabled(id: &str, app_type: &str, enabled: bool) -> Result<(), String>`
  4. 在 `dao/mod.rs` 中添加 `pub mod prompts;`
- **验收标准**: DAO 所有方法能正确读写 prompts 表

### Task 6: 实现 prompt_service_v2.rs (Prompt 服务层)
- **类型**: 后端
- **文件范围**: `src-tauri/src/services/prompt_service_v2.rs` (新建)
- **依赖**: Task 5
- **实施步骤**:
  1. 创建 `src-tauri/src/services/prompt_service_v2.rs`
  2. 实现 `PromptServiceV2` 结构体及静态方法（接收 `&Arc<Database>`），参考 `McpService` 模式
  3. 实现 live 文件路径映射：`get_live_file_path(app_type) -> Result<PathBuf, String>`
     - claude → `~/.claude/CLAUDE.md`, codex → `~/.codex/AGENTS.md`, gemini → `~/.gemini/GEMINI.md`
  4. 实现核心方法：
     - `get_prompts(db, app_type)` → 查询 DB
     - `upsert_prompt(db, prompt)` → 保存到 DB，如果 enabled 则同步到 live 文件
     - `delete_prompt(db, id, app_type)` → 仅允许删除未启用的
     - `enable_prompt(db, id, app_type)` → 核心启用流程：
       a. 读取 live 文件当前内容
       b. 查找当前 enabled prompt，将 live 内容回填（保护手动编辑）
       c. `disable_all_prompts(app_type)`
       d. `set_prompt_enabled(id, app_type, true)`
       e. 将目标 prompt content 写入 live 文件（原子写）
     - `disable_prompt(db, id, app_type)` → 取消启用
     - `import_from_file(db, app_type)` → 读取 live 文件内容，创建新 prompt
     - `get_live_content(app_type)` → 读取 live 文件返回内容
- **验收标准**:
  - 启用 prompt 时正确回填 live 文件内容到旧 prompt
  - live 文件写入正确
  - 同一 app_type 最多一个 enabled prompt

### Task 7: MCP 服务集成 Codex 同步
- **类型**: 后端
- **文件范围**: `src-tauri/src/services/mcp_service.rs`, `src-tauri/src/mcp/import.rs`
- **依赖**: Task 4
- **实施步骤**:
  1. 更新 `mcp_service.rs` 的 `upsert()` 方法：
     - 在 `enabled_codex` 变化时调用 `mcp::sync_server_to_codex` 或 `mcp::remove_server_from_codex`
     - 在同步到启用应用时添加 codex 分支
  2. 更新 `mcp_service.rs` 的 `delete()` 方法：添加 codex 移除分支
  3. 更新 `mcp_service.rs` 的 `toggle_app()` 方法：添加 codex 同步/移除分支
  4. 更新 `mcp/import.rs`：
     - 新增 `import_from_codex(db)` 函数（参考 `import_from_claude` 模式，设 `enabled_codex = true`）
     - 在 `import_from_all()` 中添加 `import_from_codex(db)` 调用
- **验收标准**:
  - `toggle_mcp_app("codex", true)` 正确写入 `~/.codex/mcp.toml`
  - `import_mcp_from_apps` 能从 Codex TOML 配置导入
  - 删除 MCP server 时同步从 codex 配置移除

### Task 8: Prompt Tauri 命令注册
- **类型**: 后端
- **文件范围**: `src-tauri/src/commands/prompt_commands.rs` (新建), `src-tauri/src/commands/mod.rs`, `src-tauri/src/services/mod.rs`, `src-tauri/src/lib.rs`
- **依赖**: Task 6, Task 7
- **实施步骤**:
  1. 创建 `src-tauri/src/commands/prompt_commands.rs`，参考 `skill_commands.rs` 模式
  2. 定义 7 个 Tauri 命令：
     - `get_prompts_v2(state, app_type) -> Vec<PromptRow>`
     - `upsert_prompt_v2(state, prompt) -> ()`
     - `delete_prompt_v2(state, id, app_type) -> ()`
     - `enable_prompt_v2(state, id, app_type) -> ()`
     - `disable_prompt_v2(state, id, app_type) -> ()`
     - `import_prompt_from_file(state, app_type) -> String`
     - `get_prompt_live_content(app_type) -> Option<String>`
  3. 在 `commands/mod.rs` 添加 `pub mod prompt_commands;`
  4. 在 `services/mod.rs` 添加 `pub mod prompt_service_v2;`
  5. 在 `lib.rs` 中：
     - 添加 `use commands::prompt_commands;`
     - 在 `generate_handler![]` 中注册 7 个命令
- **验收标准**: `cargo check` 通过，所有 Tauri 命令可从前端调用

### Task 9: 前端类型定义 + Prompt Store V2
- **类型**: 前端
- **文件范围**: `src/types/promptV2.ts` (新建), `src/stores/usePromptStoreV2.ts` (新建)
- **依赖**: Task 8
- **实施步骤**:
  1. 创建 `src/types/promptV2.ts`：
     - 定义 `PromptRow` 接口（id, appType, name, content, description?, enabled, createdAt?, updatedAt?）
     - 定义 `PROMPT_APPS` 常量：`[{key:'claude',label:'Claude',file:'CLAUDE.md'}, ...]`
  2. 创建 `src/stores/usePromptStoreV2.ts`：
     - State：`prompts: PromptRow[]`, `loading: boolean`, `liveContent: string | null`
     - Actions：
       - `loadPrompts(appType)` → `invoke('get_prompts_v2', {appType})`
       - `upsertPrompt(prompt)` → `invoke('upsert_prompt_v2', {prompt})`
       - `deletePrompt(id, appType)` → `invoke('delete_prompt_v2', {id, appType})`
       - `enablePrompt(id, appType)` → `invoke('enable_prompt_v2', {id, appType})`
       - `disablePrompt(id, appType)` → `invoke('disable_prompt_v2', {id, appType})`
       - `importFromFile(appType)` → `invoke('import_prompt_from_file', {appType})`
       - `loadLiveContent(appType)` → `invoke('get_prompt_live_content', {appType})`
- **验收标准**: Store 类型正确，所有 action 正确调用 Tauri 命令

### Task 10: PromptsPage.tsx 重构 (per-app + enable/disable)
- **类型**: 前端
- **文件范围**: `src/pages/PromptsPage.tsx`
- **依赖**: Task 9
- **实施步骤**:
  1. 添加三应用 tab 切换（Claude/Codex/Gemini），使用 DaisyUI tabs 组件
  2. 切换 tab 时调用 `loadPrompts(app)` + `loadLiveContent(app)`
  3. Prompt 列表卡片展示：名称、启用状态标记、编辑/删除/启用按钮
  4. 启用按钮调用 `enablePrompt(id, app)`，禁用调用 `disablePrompt(id, app)`
  5. 新建/编辑弹窗：name, content, description 字段
  6. 底部"从文件导入"按钮调用 `importFromFile(app)`
  7. 保留旧版"本地文件"tab（使用现有 `usePromptStore`）作为兼容
- **验收标准**:
  - 三应用 tab 切换正常
  - 启用/禁用 prompt 后 live 文件内容正确更新
  - 创建/编辑/删除 prompt 正常

### Task 11: SkillsPage.tsx 添加仓库管理 tab
- **类型**: 前端
- **文件范围**: `src/pages/SkillsPage.tsx`
- **依赖**: 无（store 已有 loadRepos/saveRepo/deleteRepo）
- **实施步骤**:
  1. 在 `pageTab` state 中添加 `'repos'` 选项
  2. 在 tab 导航中添加"仓库管理"tab
  3. 仓库管理 tab 内容：
     - 列表显示所有 SkillRepo（owner/name/branch/enabled）
     - 每行有启用/禁用开关和删除按钮
     - "添加仓库"按钮打开模态框（owner, name, branch 三字段表单）
  4. 调用 `useSkillStoreV2` 的 `loadRepos()`, `saveRepo()`, `deleteRepo()`
  5. 切换到仓库管理 tab 时自动加载仓库列表
- **验收标准**:
  - 仓库列表正常展示
  - 添加/删除仓库功能正常
  - 默认 4 个仓库可见

## 文件冲突检查

| Task | 文件范围 | 冲突检查 |
|------|---------|---------|
| Task 1 | Cargo.toml | ✅ 无冲突 |
| Task 2 | database/schema.rs | ✅ 无冲突 |
| Task 3 | database/mod.rs | ✅ 无冲突 |
| Task 4 | mcp/codex.rs (新), mcp/mod.rs | ✅ 无冲突 |
| Task 5 | dao/prompts.rs (新), dao/mod.rs | ✅ 无冲突 |
| Task 6 | services/prompt_service_v2.rs (新) | ✅ 无冲突 |
| Task 7 | services/mcp_service.rs, mcp/import.rs | ✅ 无冲突 |
| Task 8 | commands/prompt_commands.rs (新), commands/mod.rs, services/mod.rs, lib.rs | ✅ 无冲突 |
| Task 9 | types/promptV2.ts (新), stores/usePromptStoreV2.ts (新) | ✅ 无冲突 |
| Task 10 | pages/PromptsPage.tsx | ✅ 无冲突 |
| Task 11 | pages/SkillsPage.tsx | ✅ 无冲突 |

✅ 所有子任务文件范围无冲突

## 并行分组

```
Layer 0 (并行): Task 1, Task 2, Task 3, Task 11
  ↓
Layer 1 (并行): Task 4 (dep: 1), Task 5 (dep: 2)
  ↓
Layer 2 (并行): Task 6 (dep: 5), Task 7 (dep: 4)
  ↓
Layer 3: Task 8 (dep: 6, 7)
  ↓
Layer 4: Task 9 (dep: 8)
  ↓
Layer 5: Task 10 (dep: 9)
```

**依赖图**:
```
Task 1 ──→ Task 4 ──→ Task 7 ──┐
Task 2 ──→ Task 5 ──→ Task 6 ──┤→ Task 8 → Task 9 → Task 10
Task 3 (独立)                   │
Task 11 (独立)                  │
```

**Builder 数量建议**: 4 个 Builder（Layer 0 最大并行度）
