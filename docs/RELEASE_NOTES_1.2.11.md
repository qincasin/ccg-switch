# CCG Switch v1.2.11 改造总结

## 分支信息
- **分支**: `ft--`
- **版本**: 1.2.11
- **日期**: 2025-03-12
- **改动统计**: 22 个文件，+1705 / -130 行

---

## 📊 改动概览

### 文件变更统计

| 类型 | 文件数 | 说明 |
|------|--------|------|
| 新增 (A) | 3 | CHANGELOG.md, sandbox_service.rs, base64.rs |
| 修改 (M) | 19 | 后端服务、前端页面、类型定义 |

### 核心改动分布

```
后端 (Rust)
├── src-tauri/src/lib.rs                    +350 行 (终端启动功能)
├── src-tauri/src/services/sandbox_service.rs +269 行 (新增，沙箱测试)
├── src-tauri/src/services/skill_service_v2.rs +197 行 (技能管理)
├── src-tauri/src/services/skill_discovery.rs  +36 行 (技能发现)
└── src-tauri/src/utils/base64.rs            +51 行 (新增，工具函数)

前端 (TypeScript/React)
├── src/pages/SkillsPage.tsx                +507 行 (技能管理页面)
├── src/pages/Settings.tsx                   +82 行 (设置页面)
├── src/stores/useSkillStoreV2.ts            +57 行 (状态管理)
└── 其他页面/组件                            轻微修改
```

---

## ✨ 新增功能 (Features)

### 1. 技能沙箱测试系统
**文件**: `src-tauri/src/services/sandbox_service.rs`

- 支持单技能测试和对比模式（有/无技能对比）
- 自动检测 API 协议（Anthropic / OpenAI）
- 并行请求优化（对比模式）
- 智能错误处理和消息提取

```rust
pub struct SandboxRequest {
    pub provider_id: String,
    pub system_prompt: String,
    pub user_input: String,
    pub model: String,
    pub compare_mode: Option<bool>,
}
```

### 2. 技能导入/导出功能
**文件**: `src/pages/SkillsPage.tsx`, `src-tauri/src/services/skill_service_v2.rs`

- **导出**: 技能内容转换为 Base64 分享码
- **导入**: 粘贴分享码导入技能
- 支持批量导入和重复检测

### 3. 技能更新检查
**文件**: `src/pages/SkillsPage.tsx`

- 检查 GitHub 仓库技能更新
- 对比本地/远程内容差异
- 一键应用更新

### 4. 技能发现增强
**文件**: `src/pages/SkillsPage.tsx`, `src-tauri/src/services/skill_discovery.rs`

- Star 数量显示（格式化: 1.2k）
- 排序选项（按 Star 数 / 按名称）
- 自动扫描 GitHub 仓库技能

### 5. 技能清单复制
**文件**: `src/pages/SkillsPage.tsx`

- 一键复制所有已安装技能名称列表

---

## 🐛 修复问题 (Fixes)

### 1. 终端启动功能修复（核心）

| 问题 | 修复 | 文件 |
|------|------|------|
| 用户配置的终端不生效 | 从数据库加载配置（而非 JSON 文件） | `src-tauri/src/lib.rs` |
| macOS iTerm2 每次创建新窗口 | 检查现有窗口，创建新标签 | `src-tauri/src/lib.rs` |
| macOS Warp 只打开应用 | 使用 AppleScript + System Events 执行命令 | `src-tauri/src/lib.rs` |
| Windows PowerShell 路径转义不完整 | 添加双引号转义 | `src-tauri/src/lib.rs` |
| Linux 终端参数冗余 | 移除 `--working-directory` | `src-tauri/src/lib.rs` |
| 前端错误只记录到控制台 | 显示 Toast 提示 | `src/pages/WorkspacesPage.tsx` |

### 2. 前端 Bug 修复

| 问题 | 修复 | 文件 |
|------|------|------|
| ModalDialog 语法错误 | 分离 `case` 和 `default` | `src/components/common/ModalDialog.tsx` |
| Loading state 不重置 | 在操作完成后设置 `loading: false` | `src/stores/useSkillStoreV2.ts` |
| Star 数量显示截断 | 添加 `flex-wrap` 和格式化 | `src/pages/SkillsPage.tsx` |

### 3. 跨平台终端支持完善

**文件**: `src-tauri/src/lib.rs`, `src/pages/Settings.tsx`, `src/types/config.ts`

支持 9 种终端：
- **Windows**: CMD, PowerShell, Windows Terminal
- **macOS**: Terminal, iTerm2, Warp
- **Linux**: XTerm, GNOME Terminal, Konsole

### 4. 特殊字符转义

```rust
// AppleScript 转义
fn escape_apple_script(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\\\n")
        // ...
}

// Shell 转义
fn escape_shell(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('$', "\\$")
        // ...
}
```

---

## 📝 新增文件

### 1. CHANGELOG.md
版本变更日志，记录所有功能更新和 Bug 修复

### 2. src-tauri/src/services/sandbox_service.rs
技能沙箱测试服务，支持：
- 单技能测试
- 对比模式（有/无技能）
- API 协议自动检测
- 并行请求优化

### 3. src-tauri/src/utils/base64.rs
Base64 编码/解码工具函数（无外部依赖）

---

## 🔧 修改的文件（关键）

### 后端

| 文件 | 改动说明 |
|------|----------|
| `src-tauri/src/lib.rs` | 终端启动功能重构，从数据库加载配置，完善所有平台实现 |
| `src-tauri/src/services/skill_service_v2.rs` | 技能导入/导出、更新检查功能 |
| `src-tauri/src/services/skill_discovery.rs` | 技能发现增强（Star 显示） |
| `src-tauri/src/commands/skill_commands.rs` | 新增沙箱测试命令 |

### 前端

| 文件 | 改动说明 |
|------|----------|
| `src/pages/SkillsPage.tsx` | 技能管理页面重构：沙箱测试、导入导出、更新检查 |
| `src/pages/Settings.tsx` | 终端选择器改为下拉菜单，平台自动修正 |
| `src/pages/WorkspacesPage.tsx` | 添加终端启动错误提示 |
| `src/stores/useSkillStoreV2.ts` | 新增导入/导出/沙箱测试/更新检查方法 |
| `src/components/common/ModalDialog.tsx` | 修复语法错误 |
| `src/locales/zh.json`, `src/locales/en.json` | 新增翻译键 |

### 类型定义

| 文件 | 改动说明 |
|------|----------|
| `src/types/config.ts` | 扩展 TerminalType 类型 |
| `src/types/skillV2.ts` | 技能类型定义更新 |

---

## 🎯 用户可见改进

### 技能管理页面
1. **沙箱测试按钮**: 每个技能卡片新增测试按钮
2. **导入/导出按钮**: 支持分享码导入导出
3. **更新检查**: GitHub 仓库技能可检查更新
4. **Star 显示**: 发现页面显示技能 Star 数量
5. **排序功能**: 可按 Star 数或名称排序
6. **清单复制**: 一键复制已安装技能列表

### 设置页面
1. **终端选择器**: 从按钮组改为下拉菜单（按平台分组）
2. **平台自动修正**: 检测平台并修正不兼容配置

### 工作区页面
1. **错误提示**: 终端启动失败显示具体错误信息

---

## 🔐 技术改进

### 1. 配置管理
- 统一使用数据库存储配置（`load_config_from_db`）
- 移除 JSON 文件加载方式

### 2. 错误处理
- 前端错误显示 Toast（而非仅控制台）
- 后端错误消息更详细（包含具体失败原因）

### 3. 代码质量
- 修复语法错误（ModalDialog）
- 修复状态管理 bug（loading state）
- 添加工具函数（base64）

---

## 📦 依赖变更

### Cargo.toml 新增
- 无新增依赖（使用现有 reqwest）

### package-lock.json
- 依赖版本更新

---

## 🚀 发布检查清单

- [x] 代码编译通过（Rust + TypeScript）
- [x] CHANGELOG.md 更新
- [x] 翻译文件更新（中英文）
- [x] 版本号更新（package.json, Cargo.toml, tauri.conf.json）
- [ ] 功能测试（各平台终端启动）
- [ ] 沙箱测试功能验证
- [ ] 导入/导出功能验证

---

## 📌 待发布

```bash
# 更新版本号
package.json: "version": "1.2.11"
src-tauri/Cargo.toml: version = "1.2.11"
src-tauri/tauri.conf.json: "version": "1.2.11"

# 提交
git add .
git commit -m "feat(v1.2.11): 技能沙箱测试 + 终端启动功能修复"

# 合并到 main
git checkout main
git merge ft--
git push origin main
```
