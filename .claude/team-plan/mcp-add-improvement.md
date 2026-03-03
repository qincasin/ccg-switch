# Team Plan: MCP 服务器添加方式改进

## 概述
改进 MCP 服务器添加方式，引入预设选择、向导模式、JSON 直接编辑和实时预览功能，提升用户体验。

## Codex 分析摘要
- **技术可行性：高**。现有 `upsert_mcp_server` 链路完整（`src-tauri/src/commands/mcp_commands.rs:16`）
- **数据模型缺口**：需补充 `homepage/docs` 字段到数据库 schema（`src-tauri/src/database/schema.rs`）
- **校验能力**：有 `validation.rs` 但未接入主链路，需在 `upsert` 前校验
- **写回安全**：需在 `claude.rs/gemini.rs/codex.rs` 写回前剥离非协议字段
- **推荐方案**：增量改造，保留 Zustand + Tauri v2 结构

## Gemini 分析摘要
- **推荐模式**："混合向导"——预设选择 + 动态表单 + 实时预览
- **组件拆分**：McpPresetSelector、McpWizardModal、McpJsonEditor、McpPreviewPanel
- **交互设计**：
  - 药丸形预设按钮（"自定义" + 常用 MCP 列表）
  - stdio/http/sse 类型切换（带图标）
  - 动态字段显示（根据类型切换 command/url）
  - 实时 JSON 预览
  - 快捷键支持（Cmd+Enter 保存）

## 技术方案

### 架构决策
1. **保留 V2 统一管理作为主入口**：新增/编辑能力只放 V2，legacy 保持只读兼容
2. **复用现有 upsert 链路**：`useMcpStoreV2.upsertServer` → `upsert_mcp_server` 命令
3. **前端组件模块化**：拆分为预设选择器、向导模态框、JSON 编辑器等独立组件
4. **数据模型扩展**：补充 `homepage/docs` 字段，支持元数据管理

### 关键文件映射
| 功能 | 前端文件 | 后端文件 |
|------|----------|----------|
| 预设配置 | `src/config/mcpPresets.ts` | - |
| 表单模态框 | `src/components/mcp/McpFormModal.tsx` | - |
| 向导模态框 | `src/components/mcp/McpWizardModal.tsx` | - |
| JSON 解析 | `src/utils/mcpFormatters.ts` | - |
| 数据模型 | `src/types/mcpV2.ts` | `src-tauri/src/database/schema.rs` |
| DAO 层 | - | `src-tauri/src/database/dao/mcp.rs` |
| 页面集成 | `src/pages/McpPage.tsx` | - |
| i18n | `src/locales/zh.json`, `src/locales/en.json` | - |

## 子任务列表

### Task 1: 创建 MCP 预设配置
- **类型**: 前端
- **文件范围**:
  - `src/config/mcpPresets.ts` (新建)
- **依赖**: 无
- **实施步骤**:
  1. 创建 `src/config/mcpPresets.ts` 文件
  2. 实现 `createNpxCommand` 函数处理跨平台 npx 命令（Windows 使用 `cmd /c npx`）
  3. 定义 `mcpPresets` 数组，包含常用 MCP 服务器：
     - fetch (uvx mcp-server-fetch)
     - time (@modelcontextprotocol/server-time)
     - memory (@modelcontextprotocol/server-memory)
     - sequential-thinking (@modelcontextprotocol/server-sequential-thinking)
     - context7 (@upstash/context7-mcp)
  4. 实现 `getMcpPresetWithDescription` 函数支持国际化描述
- **验收标准**:
  - 预设数组可正确导出
  - Windows/Mac 命令格式正确

### Task 2: 创建 MCP 向导模态框组件
- **类型**: 前端
- **文件范围**:
  - `src/components/mcp/McpWizardModal.tsx` (新建)
- **依赖**: 无
- **实施步骤**:
  1. 创建 `McpWizardModal.tsx` 组件
  2. 实现类型选择（stdio/http/sse 单选按钮）
  3. 实现 stdio 字段：command、args、env（动态显示）
  4. 实现 http/sse 字段：url、headers（动态显示）
  5. 实现 `generatePreview` 函数生成实时 JSON 预览
  6. 实现 `parseEnvText` 和 `parseHeadersText` 解析函数
  7. 添加 Cmd+Enter 快捷键保存支持
  8. 使用 DaisyUI modal 组件风格
- **验收标准**:
  - 类型切换时字段动态显示/隐藏
  - JSON 预览实时更新
  - 快捷键可用

### Task 3: 创建 MCP 表单模态框组件
- **类型**: 前端
- **文件范围**:
  - `src/components/mcp/McpFormModal.tsx` (新建)
- **依赖**: Task 1, Task 2
- **实施步骤**:
  1. 创建 `McpFormModal.tsx` 组件
  2. 实现预设选择区（药丸形按钮组）：
     - "自定义" 按钮（默认选中）
     - 预设按钮列表（从 mcpPresets 渲染）
     - 选中态高亮样式
  3. 实现基础表单字段：id、name、description
  4. 实现应用开关区（claude/codex/gemini/opencode）
  5. 实现 JSON 配置编辑器（使用 textarea + 语法高亮样式）
  6. 集成向导模式入口（"使用向导"按钮 → 打开 McpWizardModal）
  7. 实现 `handleConfigChange` 智能解析 JSON
  8. 实现 `applyPreset` 应用预设配置
  9. 实现 `handleSubmit` 调用 `upsertServer`
- **验收标准**:
  - 预设选择可一键填充表单
  - JSON 编辑器可粘贴配置
  - 向导模式可正常打开和返回

### Task 4: 扩展数据模型和类型定义
- **类型**: 前端
- **文件范围**:
  - `src/types/mcpV2.ts` (修改)
- **依赖**: 无
- **实施步骤**:
  1. 在 `McpServerRow` 接口中添加 `homepage?: string` 字段
  2. 在 `McpServerRow` 接口中添加 `docs?: string` 字段
  3. 在 `McpServerRow` 接口中添加 `tags?: string[]` 字段
  4. 确保 `McpServerConfig` 接口完整支持 stdio/http/sse 类型
- **验收标准**:
  - TypeScript 类型定义完整
  - 与后端数据结构对应

### Task 5: 扩展后端数据库 Schema
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/database/schema.rs` (修改)
  - `src-tauri/src/database/dao/mcp.rs` (修改)
- **依赖**: 无
- **实施步骤**:
  1. 在 `schema.rs` 的 `mcp_servers` 表定义中添加 `homepage TEXT` 列
  2. 在 `schema.rs` 的 `mcp_servers` 表定义中添加 `docs TEXT` 列
  3. 添加迁移逻辑：检查列是否存在，不存在则 ALTER TABLE ADD COLUMN
  4. 在 `dao/mcp.rs` 的 `McpServerRow` 结构体中添加对应字段
  5. 更新 `insert_or_update_mcp_server` SQL 语句包含新字段
  6. 更新 `get_all_mcp_servers` 查询返回新字段
- **验收标准**:
  - 数据库迁移不破坏现有数据
  - 新字段可正常读写

### Task 6: 集成到 MCP 页面
- **类型**: 前端
- **文件范围**:
  - `src/pages/McpPage.tsx` (修改)
- **依赖**: Task 3
- **实施步骤**:
  1. 在 V2 标签页顶栏添加"添加"按钮
  2. 添加 `isFormOpen` 状态控制表单模态框显示
  3. 添加 `editingServer` 状态存储编辑中的服务器
  4. 实现 `handleAdd` 打开新增模态框
  5. 实现 `handleEdit` 打开编辑模态框（传入现有数据）
  6. 在卡片组件中添加编辑按钮
  7. 集成 `McpFormModal` 组件
  8. 实现 `handleSave` 调用 `useMcpStoreV2.upsertServer`
- **验收标准**:
  - V2 页面可新增服务器
  - 可编辑现有服务器
  - 保存后列表自动刷新

### Task 7: 添加国际化文案
- **类型**: 前端
- **文件范围**:
  - `src/locales/zh.json` (修改)
  - `src/locales/en.json` (修改)
- **依赖**: 无
- **实施步骤**:
  1. 添加 `mcp.form.*` 相关文案（title, name, description, enabledApps 等）
  2. 添加 `mcp.wizard.*` 相关文案（type, command, args, env, url, headers, preview 等）
  3. 添加 `mcp.presets.*` 相关文案（title, custom, 各预设描述）
  4. 添加 `mcp.error.*` 相关文案（idRequired, commandRequired, jsonInvalid 等）
  5. 中英文同步更新
- **验收标准**:
  - 所有新增 UI 文案有中英文翻译
  - 无硬编码字符串

### Task 8: Store 层补充 upsert 方法
- **类型**: 前端
- **文件范围**:
  - `src/stores/useMcpStoreV2.ts` (修改)
- **依赖**: Task 4
- **实施步骤**:
  1. 检查现有 `upsertServer` 方法实现
  2. 确保方法支持新增和编辑两种场景
  3. 添加 `homepage/docs/tags` 字段传递
  4. 添加错误处理和 toast 提示
- **验收标准**:
  - `upsertServer` 可正常新增服务器
  - `upsertServer` 可正常更新服务器
  - 错误有友好提示

## 文件冲突检查
✅ 无冲突 - 各任务文件范围独立：
- Task 1/2/3: 新建文件，无冲突
- Task 4: 只修改 types 文件
- Task 5: 只修改后端 Rust 文件
- Task 6: 只修改 McpPage.tsx
- Task 7: 只修改 i18n 文件
- Task 8: 只修改 store 文件

## 并行分组
- **Layer 1 (并行)**: Task 1, Task 2, Task 4, Task 5, Task 7
- **Layer 2 (依赖 Layer 1)**: Task 3, Task 8
- **Layer 3 (依赖 Layer 2)**: Task 6

## Builder 分配建议
| Builder | 任务 | 技术栈 |
|---------|------|--------|
| Builder-Frontend-1 | Task 1, Task 2 | React + TypeScript |
| Builder-Frontend-2 | Task 4, Task 7 | TypeScript + i18n |
| Builder-Backend | Task 5 | Rust + SQLite |
| Builder-Frontend-3 | Task 3 (依赖 1,2) | React + DaisyUI |
| Builder-Frontend-4 | Task 8 (依赖 4) | Zustand |
| Builder-Frontend-5 | Task 6 (依赖 3,8) | React |
