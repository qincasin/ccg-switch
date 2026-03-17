# Team Plan: macos-tool-detection

## 概述
在 `tool_version_service.rs` 中添加 `scan_cli_version` 路径扫描备选方案，修复 macOS 桌面应用无法检测已安装 CLI 工具的问题。

## 技术方案

参考 cc-switch 项目的 `scan_cli_version` 实现，在 `try_get_version` 失败后扫描常见安装路径：

**调用链变更**：
```
get_single_tool_version()
  → try_get_version(tool)          // 现有：sh -c "{tool} --version"
  → if failed: scan_cli_version(tool)  // 新增：扫描常见路径
```

**扫描路径列表**：
- 通用：`~/.local/bin`、`~/.npm-global/bin`、`~/n/bin`、`~/.volta/bin`
- macOS：`/opt/homebrew/bin`（Apple Silicon）、`/usr/local/bin`（Intel）
- Linux：`/usr/local/bin`、`/usr/bin`
- Windows：`%APPDATA%/npm`、`C:\Program Files\nodejs`
- nvm：`~/.nvm/versions/node/*/bin`
- fnm：`~/.local/state/fnm_multishells/*/bin`
- opencode 特有：`~/go/bin`、`~/.opencode/bin`

## 子任务列表

### Task 1: 添加路径扫描函数到 tool_version_service.rs
- **类型**: 后端
- **文件范围**: `src-tauri/src/services/tool_version_service.rs`
- **依赖**: 无
- **实施步骤**:
  1. 添加 `push_unique_path` 辅助函数（去重路径添加）
  2. 添加 `tool_executable_candidates` 函数（Windows 上检查 .cmd/.exe，其他平台直接用工具名）
  3. 添加 `scan_cli_version(tool)` 函数：
     - 构建搜索路径列表（按平台条件编译）
     - 扫描 nvm/fnm 动态路径
     - opencode 特有路径
     - 遍历路径，检查可执行文件存在性，找到后执行 `--version`
  4. 修改 `get_single_tool_version`：`try_get_version` 失败后调用 `scan_cli_version`
- **验收标准**: `cargo check` 编译通过

## 文件冲突检查
✅ 无冲突 — 仅修改单个文件

## 并行分组
- Layer 1: Task 1（单任务，直接执行）
