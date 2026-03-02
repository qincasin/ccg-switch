# Team Research: MCP / Skills / Prompts 功能完善

## 增强后的需求

**目标**：参照 cc-switch (v3.10.3) 的成熟实现，补全 claude-switch-1.0 中 MCP Management、Skills Management、Prompts Management 三大功能的缺失部分。

**范围限定**：
- 仅支持 Claude / Codex / Gemini 三个应用（移除 OpenCode / OpenClaw）
- 不涉及云同步、WebDAV、自动启动等外围功能
- 不涉及 Provider 管理（已完成）

**验收标准**：
- MCP：三个应用的配置文件均可读写和同步
- Skills：默认仓库可用、发现/安装/卸载完整链路
- Prompts：支持 per-app 创建/切换/启用、live 文件双向同步

---

## 约束集

### 硬约束

- [HC-1] 技术栈：Tauri 2 + Rust 后端 + React 19 前端 + SQLite (rusqlite 0.31 bundled)
- [HC-2] 数据库路径：`~/.claude-switch/cc-switch.db`（已有）
- [HC-3] 三应用限定：仅 Claude / Codex / Gemini，数据库字段 `enabled_claude / enabled_codex / enabled_gemini`
- [HC-4] 不破坏现有功能：Provider、Proxy、Dashboard 等模块不可回归
- [HC-5] Codex MCP 配置格式为 TOML（非 JSON），路径 `~/.codex/mcp.toml`
- [HC-6] Windows 兼容：Skills 同步使用 copy（非 symlink），路径使用 `dirs::home_dir()`
- [HC-7] 现有 MCP 模块结构：`src-tauri/src/mcp/` 下 `mod.rs / claude.rs / gemini.rs / import.rs`
- [HC-8] Prompts live 文件路径固定：Claude → `~/.claude/CLAUDE.md`，Codex → `~/.codex/AGENTS.md`，Gemini → `~/.gemini/GEMINI.md`

### 软约束

- [SC-1] 代码风格：遵循现有 `claude.rs` / `gemini.rs` 的模式编写 `codex.rs`
- [SC-2] 前端风格：遵循现有 DaisyUI 组件 + Tailwind 样式
- [SC-3] 命令命名：遵循现有 `mcp_commands` / `skill_commands` 前缀模式
- [SC-4] Cargo 依赖：新增 `toml` crate 用于 Codex TOML 解析/生成
- [SC-5] 默认仓库列表：anthropics/skills、ComposioHQ/awesome-claude-skills、cexll/myclaude、JimLiu/baoyu-skills

### 依赖关系

- [DEP-1] Codex MCP 同步 → 需先添加 `toml` crate 到 Cargo.toml
- [DEP-2] Prompts 数据库化 → 需先在 `schema.rs` 添加 `prompts` 表 + migration
- [DEP-3] Skills 默认仓库 → 需在 `Database::init()` 中添加初始化逻辑
- [DEP-4] 前端 Prompts 重构 → 需后端 Tauri 命令先就绪

### 风险

- [RISK-1] Codex TOML 格式不确定 — 缓解：参照 cc-switch 实现 + 实际 Codex 文档验证
- [RISK-2] 现有 Prompts 文件系统数据迁移 — 缓解：保留旧命令兼容，新功能使用新命令名
- [RISK-3] `~/.claude/CLAUDE.md` 被用户手动编辑 — 缓解：启用时回填机制

---

## 当前实现状态 vs 目标

### 1. MCP Management

| 子功能 | 当前状态 | 目标 | 缺口 |
|--------|---------|------|------|
| Claude 同步 | ✅ `mcp/claude.rs` 读写 `~/.claude.json` | 完成 | 无 |
| Gemini 同步 | ✅ `mcp/gemini.rs` 读写 `~/.gemini/settings.json` | 完成 | 无 |
| Codex 同步 | ❌ 无 `mcp/codex.rs` | 读写 `~/.codex/mcp.toml` (TOML) | **Critical** |
| 导入功能 | ✅ `mcp/import.rs` 支持 Claude + Gemini | 三应用导入 | 缺 Codex 导入 |
| toggle_mcp_app | ✅ 服务层有逻辑 | codex 分支无效 | 需连接 codex.rs |
| 前端 UI | ✅ McpPage 有 v2 tab | 完成 | 无 |

### 2. Skills Management

| 子功能 | 当前状态 | 目标 | 缺口 |
|--------|---------|------|------|
| 数据库表 | ✅ skills + skill_repos 表 | 完成 | 无 |
| GitHub 发现 | ✅ skill_discovery.rs | 完成 | 无 |
| 安装/卸载 | ✅ skill_service_v2.rs | 完成 | 无 |
| 多应用同步 | ✅ sync_to_app_dir | 完成 | 无 |
| 默认仓库 | ❌ 空表 | 4个默认仓库 | **需初始化** |
| 仓库管理 UI | ❌ SkillsPage 无仓库 tab | 添加/删除自定义仓库 | **需前端** |

### 3. Prompts Management

| 子功能 | 当前状态 | 目标 (cc-switch 模型) | 缺口 |
|--------|---------|----------------------|------|
| 存储 | 文件系统 `~/.claude-switch/prompts/*.md` | SQLite DB `prompts` 表 | **需重构** |
| 模型 | 全局 Prompt（无 per-app） | per-app（每应用独立列表） | **需重构** |
| 启用/禁用 | 无概念 | 单选启用 + 自动备份 | **需新增** |
| Live 文件同步 | 拷贝到 `~/.{app}/prompts/` 子目录 | 写入 `CLAUDE.md / AGENTS.md / GEMINI.md` | **需重构** |
| 回填保护 | 无 | 启用前读取 live 文件，回填到旧 Prompt | **需新增** |
| 导入 | 无 | 从 live 文件导入到 DB | **需新增** |
| 前端 UI | ✅ PromptsPage 有 CRUD | per-app tab + 启用/禁用 | **需重构** |
| Tauri 命令 | 6 条（旧 FS 版） | 新增 DB 版命令 | **需新增** |

---

## 实施规格

### Feature 1: Codex MCP 支持 (Critical)

#### 1.1 新增 Cargo 依赖

**文件**: `src-tauri/Cargo.toml`

```toml
toml = "0.8"   # TOML 解析/生成
```

#### 1.2 创建 `src-tauri/src/mcp/codex.rs`

**参考**: 现有 `claude.rs` (94行) 和 `gemini.rs` (85行) 的模式

**Codex MCP 配置路径**: `~/.codex/mcp.toml`

**TOML 格式**（参照 cc-switch）:

```toml
[mcp_servers.server_name]
type = "stdio"
command = "npx"
args = ["-y", "@anthropic/mcp-fetch"]

[mcp_servers.another_server]
type = "sse"
url = "http://localhost:3000/sse"
```

**核心函数签名**:

```rust
use std::collections::HashMap;
use serde_json::Value;

/// 读取 ~/.codex/mcp.toml 中的 [mcp_servers] 部分
fn read_mcp_servers() -> HashMap<String, Value>

/// 将完整的 mcp_servers HashMap 写入 ~/.codex/mcp.toml
fn write_mcp_servers(servers: &HashMap<String, Value>) -> Result<(), String>

/// 同步单个 MCP server 到 Codex 配置（JSON → TOML 转换）
pub fn sync_server_to_codex(id: &str, server_spec: &Value) -> Result<(), String>

/// 从 Codex 配置中删除单个 MCP server
pub fn remove_server_from_codex(id: &str) -> Result<(), String>

/// 读取 Codex 配置用于导入
pub fn read_codex_mcp_for_import() -> HashMap<String, Value>
```

**关键逻辑**:
- 读取时：`toml::from_str()` → 提取 `mcp_servers` 表
- 写入时：保留文件中其他非 `[mcp_servers]` 部分，仅替换 MCP 段
- JSON ↔ TOML 值转换：`serde_json::Value` ↔ `toml::Value` 互转

#### 1.3 更新 `src-tauri/src/mcp/mod.rs`

```rust
pub mod claude;
pub mod codex;  // 新增
pub mod gemini;
pub mod import;
```

#### 1.4 更新 `src-tauri/src/services/mcp_service.rs`

在 `sync_server_to_apps()` 和 `remove_server_from_apps()` 中添加 codex 分支:

```rust
// 现有:
if row.enabled_claude { claude::sync_server_to_claude(&row.id, &spec)?; }
if row.enabled_gemini { gemini::sync_server_to_gemini(&row.id, &spec)?; }
// 新增:
if row.enabled_codex { codex::sync_server_to_codex(&row.id, &spec)?; }
```

在 `toggle_mcp_app()` 中确保 codex 分支调用 `codex.rs`:

```rust
"codex" => {
    row.enabled_codex = enabled;
    if enabled {
        codex::sync_server_to_codex(&row.id, &spec)?;
    } else {
        codex::remove_server_from_codex(&row.id)?;
    }
}
```

#### 1.5 更新 `src-tauri/src/mcp/import.rs`

添加 Codex 导入:

```rust
pub fn import_from_codex(db: &Arc<Database>) -> Result<usize, String> {
    let codex_servers = codex::read_codex_mcp_for_import();
    // ... 同 import_from_claude 逻辑，设 enabled_codex = true
}
```

在 `import_from_all_apps()` 中添加:

```rust
count += import_from_codex(db)?;
```

---

### Feature 2: Skills 默认仓库初始化

#### 2.1 更新 `src-tauri/src/database/mod.rs`

在 `Database::init()` 末尾添加默认仓库初始化:

```rust
impl Database {
    pub fn init() -> Result<Self, String> {
        // ... 现有建表逻辑 ...
        let db = Database { conn: Mutex::new(conn) };
        db.init_default_skill_repos()?;
        Ok(db)
    }

    fn init_default_skill_repos(&self) -> Result<(), String> {
        let existing = self.get_skill_repos()?;
        if !existing.is_empty() {
            return Ok(()); // 已有仓库，跳过
        }
        let defaults = vec![
            SkillRepo { owner: "anthropics".into(), name: "skills".into(), branch: "main".into(), enabled: true },
            SkillRepo { owner: "ComposioHQ".into(), name: "awesome-claude-skills".into(), branch: "main".into(), enabled: true },
            SkillRepo { owner: "cexll".into(), name: "myclaude".into(), branch: "main".into(), enabled: true },
            SkillRepo { owner: "JimLiu".into(), name: "baoyu-skills".into(), branch: "main".into(), enabled: true },
        ];
        for repo in defaults {
            self.save_skill_repo(&repo)?;
        }
        Ok(())
    }
}
```

#### 2.2 前端仓库管理 UI

**更新 `src/pages/SkillsPage.tsx`**，在"发现"tab 上方或旁边添加仓库管理区域:

```
已安装 | 发现 | 仓库管理 | 本地文件
         ↑                ↑
    现有 tab         新增 tab
```

仓库管理 tab 功能:
- 列表显示所有 `SkillRepo`（owner/name/branch/enabled）
- 每行有启用/禁用开关和删除按钮
- "添加仓库" 按钮打开表单（owner, name, branch 三个字段）
- 调用已有的 `save_skill_repo` / `delete_skill_repo` 命令

---

### Feature 3: Prompts 系统重构 (DB + per-app + live 文件同步)

#### 3.1 数据库层

**更新 `src-tauri/src/database/schema.rs`**，添加 prompts 表:

```sql
CREATE TABLE IF NOT EXISTS prompts (
    id TEXT NOT NULL,
    app_type TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER,
    PRIMARY KEY (id, app_type)
)
```

**设计说明**:
- 复合主键 `(id, app_type)`：每个应用独立维护 Prompt 列表
- `app_type`：`"claude"` / `"codex"` / `"gemini"`
- `enabled`：0 或 1，同一 app_type 下最多一个 `enabled=1`

**新增 DAO 文件**: `src-tauri/src/database/dao/prompts.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptRow {
    pub id: String,
    pub app_type: String,
    pub name: String,
    pub content: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

impl Database {
    pub fn get_prompts(&self, app_type: &str) -> Result<Vec<PromptRow>, String>
    pub fn save_prompt(&self, prompt: &PromptRow) -> Result<(), String>
    pub fn delete_prompt(&self, id: &str, app_type: &str) -> Result<(), String>
    pub fn disable_all_prompts(&self, app_type: &str) -> Result<(), String>
}
```

#### 3.2 服务层

**新增文件**: `src-tauri/src/services/prompt_service_v2.rs`

```rust
pub struct PromptServiceV2;

impl PromptServiceV2 {
    /// 获取指定应用的所有 Prompts
    pub fn get_prompts(db: &Arc<Database>, app_type: &str) -> Result<Vec<PromptRow>, String>

    /// 创建或更新 Prompt（保存到 DB，如果 enabled 则同步到 live 文件）
    pub fn upsert_prompt(db: &Arc<Database>, prompt: PromptRow) -> Result<(), String>

    /// 删除 Prompt（仅允许删除已禁用的）
    pub fn delete_prompt(db: &Arc<Database>, id: &str, app_type: &str) -> Result<(), String>

    /// 启用指定 Prompt（核心逻辑）
    /// 1. 读取 live 文件当前内容
    /// 2. 回填到当前已启用的 Prompt（保护手动编辑）
    /// 3. 禁用其他所有 Prompt
    /// 4. 启用目标 Prompt
    /// 5. 将内容写入 live 文件
    pub fn enable_prompt(db: &Arc<Database>, id: &str, app_type: &str) -> Result<(), String>

    /// 禁用指定 Prompt
    pub fn disable_prompt(db: &Arc<Database>, id: &str, app_type: &str) -> Result<(), String>

    /// 从 live 文件导入（读取 CLAUDE.md/AGENTS.md/GEMINI.md 内容创建新 Prompt）
    pub fn import_from_file(db: &Arc<Database>, app_type: &str) -> Result<String, String>

    /// 获取 live 文件当前内容（用于 UI 预览）
    pub fn get_live_file_content(app_type: &str) -> Result<Option<String>, String>
}
```

**Live 文件路径映射**:

```rust
fn get_live_file_path(app_type: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Home not found")?;
    match app_type {
        "claude" => Ok(home.join(".claude").join("CLAUDE.md")),
        "codex" => Ok(home.join(".codex").join("AGENTS.md")),
        "gemini" => Ok(home.join(".gemini").join("GEMINI.md")),
        _ => Err(format!("不支持的应用: {}", app_type)),
    }
}
```

**启用 Prompt 流程（核心）**:

```
enable_prompt("target-id", "claude")
  │
  ├─ 1. 读取 ~/.claude/CLAUDE.md 当前内容
  │
  ├─ 2. 查找 DB 中 app_type="claude" && enabled=true 的 Prompt
  │     ├─ 找到 → 将 live 文件内容回填到该 Prompt 的 content（保护手动编辑）
  │     └─ 未找到 且 live 文件有内容 → 创建 backup-{timestamp} Prompt
  │
  ├─ 3. disable_all_prompts("claude")
  │
  ├─ 4. 设置目标 Prompt enabled=true，更新 updated_at
  │
  └─ 5. 将目标 Prompt 的 content 写入 ~/.claude/CLAUDE.md
```

#### 3.3 Tauri 命令层

**新增文件**: `src-tauri/src/commands/prompt_commands.rs`

```rust
#[tauri::command]
pub fn get_prompts_v2(state: State<AppState>, app_type: String) -> Result<Vec<PromptRow>, String>

#[tauri::command]
pub fn upsert_prompt_v2(state: State<AppState>, prompt: PromptRow) -> Result<(), String>

#[tauri::command]
pub fn delete_prompt_v2(state: State<AppState>, id: String, app_type: String) -> Result<(), String>

#[tauri::command]
pub fn enable_prompt_v2(state: State<AppState>, id: String, app_type: String) -> Result<(), String>

#[tauri::command]
pub fn disable_prompt_v2(state: State<AppState>, id: String, app_type: String) -> Result<(), String>

#[tauri::command]
pub fn import_prompt_from_file(state: State<AppState>, app_type: String) -> Result<String, String>

#[tauri::command]
pub fn get_prompt_live_content(app_type: String) -> Result<Option<String>, String>
```

**注册到 lib.rs**:
```rust
use commands::prompt_commands;
// generate_handler! 中添加 7 条命令
```

#### 3.4 前端类型

**新增文件**: `src/types/promptV2.ts`

```typescript
export interface PromptRow {
    id: string;
    appType: string;      // "claude" | "codex" | "gemini"
    name: string;
    content: string;
    description?: string;
    enabled: boolean;
    createdAt?: number;
    updatedAt?: number;
}

export const PROMPT_APPS = [
    { key: 'claude', label: 'Claude', file: 'CLAUDE.md' },
    { key: 'codex', label: 'Codex', file: 'AGENTS.md' },
    { key: 'gemini', label: 'Gemini', file: 'GEMINI.md' },
] as const;
```

#### 3.5 前端 Store

**新增文件**: `src/stores/usePromptStoreV2.ts`

```typescript
interface PromptStoreV2 {
    prompts: PromptRow[];
    loading: boolean;
    liveContent: string | null;
    // Actions
    loadPrompts(appType: string): Promise<void>;
    upsertPrompt(prompt: PromptRow): Promise<void>;
    deletePrompt(id: string, appType: string): Promise<void>;
    enablePrompt(id: string, appType: string): Promise<void>;
    disablePrompt(id: string, appType: string): Promise<void>;
    importFromFile(appType: string): Promise<string>;
    loadLiveContent(appType: string): Promise<void>;
}
```

#### 3.6 前端 UI 重构

**更新 `src/pages/PromptsPage.tsx`**:

```
布局设计：
┌─────────────────────────────────────────────┐
│ Prompts   [Claude] [Codex] [Gemini]  [+新建] │  ← 应用选择 tab
├─────────────────────────────────────────────┤
│ ┌─ Prompt Card ──────────────────────────┐  │
│ │ 名称: My Prompt   [✓ 已启用] [编辑] [删] │  │  ← 启用的 Prompt 高亮
│ │ 预览: ## System Instructions...        │  │
│ └────────────────────────────────────────┘  │
│ ┌─ Prompt Card ──────────────────────────┐  │
│ │ 名称: Backup     [启用] [编辑] [删除]    │  │  ← 未启用的 Prompt
│ └────────────────────────────────────────┘  │
│                                             │
│ [从文件导入]  Live 文件: ~/.claude/CLAUDE.md │  ← 底部导入按钮
├─────────────────────────────────────────────┤
│ 本地文件（旧版）                               │  ← 保留旧功能 tab
└─────────────────────────────────────────────┘
```

核心交互:
- 点击应用 tab → `loadPrompts(app)` + `loadLiveContent(app)`
- 点击"启用" → `enablePrompt(id, app)`，自动回填 + 切换
- 点击"新建" → 弹出表单（name, content, description）
- "从文件导入" → `importFromFile(app)`，创建新 Prompt

---

## 实施顺序

```
Layer 0: 基础设施
  ├─ Task 1: Cargo.toml 添加 toml 依赖
  ├─ Task 2: schema.rs 添加 prompts 表
  └─ Task 3: database/mod.rs 添加默认仓库初始化

Layer 1: 后端服务 (可并行)
  ├─ Task 4: mcp/codex.rs (TOML 读写)
  ├─ Task 5: database/dao/prompts.rs (Prompt DAO)
  └─ Task 6: services/prompt_service_v2.rs (Prompt 服务)

Layer 2: 后端集成
  ├─ Task 7: mcp_service.rs + import.rs 集成 codex
  ├─ Task 8: commands/prompt_commands.rs (Tauri 命令)
  └─ Task 9: lib.rs 注册新命令

Layer 3: 前端 (可并行)
  ├─ Task 10: types/promptV2.ts + stores/usePromptStoreV2.ts
  ├─ Task 11: PromptsPage.tsx 重构 (per-app + enable/disable)
  └─ Task 12: SkillsPage.tsx 添加仓库管理 tab
```

**依赖图**:
```
Task 1 ──→ Task 4 ──→ Task 7 ──→ Task 9
Task 2 ──→ Task 5 ──→ Task 6 ──→ Task 8 ──→ Task 9 ──→ Task 10 ──→ Task 11
Task 3 (独立)
Task 12 (独立)
```

---

## 成功判据

- [OK-1] `toggle_mcp_app("codex", true)` 写入 `~/.codex/mcp.toml` TOML 格式正确
- [OK-2] `import_mcp_from_apps` 能从 Codex 的 TOML 配置导入
- [OK-3] `discover_skills` 返回默认 4 个仓库的技能列表
- [OK-4] SkillsPage 仓库管理 tab 可添加/删除自定义仓库
- [OK-5] PromptsPage 按应用切换显示各自的 Prompt 列表
- [OK-6] 启用 Prompt 时，回填当前 live 文件内容到旧 Prompt
- [OK-7] 启用 Prompt 后，对应 `CLAUDE.md / AGENTS.md / GEMINI.md` 内容正确更新
- [OK-8] 从 live 文件导入功能创建新 Prompt 记录
- [OK-9] `cargo check` 0 错误
- [OK-10] `npx tsc --noEmit` 0 错误

## 开放问题（已解决）

- Q1: Codex MCP 配置文件路径？ → A: `~/.codex/mcp.toml`（TOML 格式，`[mcp_servers]` section）
- Q2: Prompts 使用 DB 还是文件系统？ → A: DB（per-app 复合主键），对齐 cc-switch 架构
- Q3: 旧 Prompts 命令是否保留？ → A: 保留兼容（不删除），新增 v2 后缀命令
- Q4: Skills 默认仓库何时初始化？ → A: `Database::init()` 中幂等检查
