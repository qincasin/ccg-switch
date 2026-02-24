# CC Switch (claude-switch-1.0)

Claude Code 配置管理桌面应用，基于 Tauri 2 构建。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript 5.8 + Vite 7 |
| UI | TailwindCSS 3 + DaisyUI 4 |
| 状态 | Zustand 5 |
| 国际化 | i18next (zh/en) |
| 路由 | react-router-dom 7 (HashRouter) |
| 后端 | Rust (edition 2021) + Tauri 2 |
| 序列化 | serde + serde_json (preserve_order) |
| HTTP | reqwest 0.12 |
| 时间 | chrono 0.4 |
| 图标 | lucide-react |

## 运行

```bash
npm install
npm run tauri dev    # 开发模式
npm run tauri build  # 生产构建
```

## 架构

```
src/                          # React 前端
├── App.tsx                   # 路由定义 (createHashRouter)
├── pages/                    # 页面组件
├── components/layout/        # 布局组件 (Layout, Navbar)
├── components/common/        # 通用组件 (ModalDialog)
├── stores/                   # Zustand 状态管理
├── locales/                  # i18n 翻译文件
└── types/                    # TypeScript 类型定义

src-tauri/src/                # Rust 后端
├── lib.rs                    # Tauri 命令注册入口
├── models/                   # 数据模型 (serde Serialize/Deserialize)
└── services/                 # 业务逻辑层
```

## 页面路由

| 路径 | 组件 | 功能 |
|------|------|------|
| `/` | Dashboard | 统计概览、活跃度图表、项目列表、模块入口 |
| `/claude` | ClaudePage | API Key 管理（表格/卡片双视图、搜索、切换） |
| `/mcp` | McpPage | MCP 服务器增删改（全局/项目级） |
| `/prompts` | PromptsPage | CLAUDE.md Prompt 预设管理 |
| `/skills` | SkillsPage | 用户/项目技能管理 |
| `/subagents` | SubagentsPage | 自定义子代理管理 |
| `/settings` | Settings | 主题切换、语言切换 |

## Tauri 命令

### 配置管理
- `get_config` / `save_config` — 应用配置 (主题、语言)

### Claude API Token
- `get_tokens` — 获取所有 Token
- `add_api_token` / `update_api_token` / `delete_api_token` — CRUD
- `switch_api_token` — 切换活跃 Token（写入 `~/.claude/settings.json`）
- `fetch_available_models` — 从 API 获取可用模型列表

### MCP 服务器
- `list_mcp_servers` / `add_mcp_server` / `delete_mcp_server`

### Prompt 预设
- `list_prompts` / `get_prompt` / `save_prompt` / `delete_prompt`

### 技能管理
- `list_skills` / `get_skill` / `save_skill` / `delete_skill`

### 子代理
- `list_subagents` / `get_subagent` / `save_subagent` / `delete_subagent`

### 仪表盘
- `get_dashboard_stats` — 统计数据（启动次数、项目数、会话数、历史记录数）
- `get_dashboard_projects` — 项目工作区列表
- `get_activity_history` — 会话活跃度（按天统计）

## 数据路径

| 文件 | 路径 | 说明 |
|------|------|------|
| 应用配置 | `~/.claude-switch/config.json` | 主题、语言设置 |
| Token 数据 | `~/.ci/claude_switch.json` | API Key 列表 |
| Claude 设置 | `~/.claude/settings.json` | Claude Code 运行时配置 |
| MCP 全局配置 | `~/.claude.json` | MCP 服务器定义 |
| 项目数据 | `~/.claude/projects/` | 各项目会话记录 |
| 历史记录 | `~/.claude/history.jsonl` | 命令历史 |

## 数据模型

### ApiToken (`models/token.rs`)
```rust
pub struct ApiToken {
    pub id: String,
    pub name: String,
    pub api_key: String,           // apiKey
    pub url: Option<String>,
    pub default_sonnet_model: Option<String>,
    pub default_opus_model: Option<String>,
    pub default_haiku_model: Option<String>,
    pub custom_params: Option<HashMap<String, Value>>,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
}
```

### Token 切换机制
`switch_api_token` 将选中 Token 的配置写入 `~/.claude/settings.json` 的 `env` 字段：
- `ANTHROPIC_AUTH_TOKEN` — API Key
- `ANTHROPIC_BASE_URL` — 自定义 URL
- `ANTHROPIC_DEFAULT_SONNET_MODEL` / `OPUS` / `HAIKU` — 模型映射

## UI 规范

### 布局模式
- 页面容器: `h-full w-full overflow-y-auto`
- 内容区域: `p-6 space-y-* max-w-7xl mx-auto`
- Tauri 窗口拖拽: `data-tauri-drag-region`，Navbar 使用 `pt-9` 避让

### 组件风格
- 卡片: `bg-white dark:bg-base-100 rounded-xl shadow-sm border border-gray-100 dark:border-base-200`
- 按钮: DaisyUI `btn` 组件，渐变色 `from-orange-500 to-pink-500`
- 导航: 药丸形标签 `rounded-full`，激活态 `bg-gray-900 text-white`
- 主题切换: View Transition API 圆形扩散动画

### 跨平台
- 路径处理使用 `@tauri-apps/api/path`（`homeDir`, `join`）
- 不硬编码路径分隔符
- Shell 权限: `shell:allow-open` + `"open": ".*"`

## 开发注意事项

- 修改 Rust 代码后需重启 `tauri dev`，前端 HMR 自动生效
- JSON 字段使用 camelCase（`#[serde(rename = "apiKey")]`），Rust 内部 snake_case
- 国际化: 新增文案需同时更新 `zh.json` 和 `en.json`
- 页面组件导出为 `default export`
- 新增 Tauri 命令需在 `lib.rs` 的 `generate_handler!` 中注册
