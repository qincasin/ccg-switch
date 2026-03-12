# Changelog

## [1.2.11] - 2025-03-12

### Fixed - 终端启动功能修复

| 问题 | 修复 |
|------|------|
| **核心**: 用户配置的终端不生效 | `launch_resume_session` 改为从数据库加载配置 |
| **macOS iTerm2**: 每次都创建新窗口 | 检查现有窗口，创建新标签 |
| **macOS Warp**: 只打开应用，不执行命令 | 使用 AppleScript + System Events 执行命令 |
| **Windows PowerShell**: 路径转义不完整 | 添加双引号转义 |
| **Linux**: 终端参数冗余 | 移除 `--working-directory`，统一使用 bash `cd` |
| **前端**: 错误只记录到控制台 | 显示 Toast 提示 |

### 改动文件
- `src-tauri/src/lib.rs` - 终端启动逻辑
- `src/pages/WorkspacesPage.tsx` - 添加 Toast 提示
- `src/locales/zh.json`, `src/locales/en.json` - 翻译

---

## [1.2.10] - 2025-03-11
- 跨平台终端支持（9 种）
- 设置页面终端选择器
- 修复重装后配置复活问题

## [1.2.9]
- 技能管理 V2
- 沙箱测试功能
- 配置文件到数据库迁移
