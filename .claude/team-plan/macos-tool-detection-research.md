# Team Research: macos-tool-detection

## 增强后的需求

**问题**：macOS 上设置页"本地环境检查"无法识别已安装的 Claude Code / Gemini CLI / OpenCode，全部显示"未安装"。Windows 正常。

**根因**：
1. `tool_version_service.rs` 的 `try_get_version()` 在 macOS 上使用 `sh -c "{tool} --version"`
2. macOS 桌面应用从 Finder/Dock 启动时，**不会加载用户的 shell 配置文件**（`.bashrc`/`.zshrc`）
3. 因此 `sh -c` 的 PATH 环境变量不包含 npm 全局包路径（`~/.npm/bin`）、Homebrew（`/opt/homebrew/bin`）、nvm/fnm 等版本管理器路径
4. 导致 `sh -c "claude --version"` 等命令找不到可执行文件

**参考项目解决方案**（cc-switch）：
- `try_get_version()` 失败后，调用 `scan_cli_version()` 作为备选
- `scan_cli_version()` 扫描常见安装路径列表，直接执行找到的可执行文件
- 搜索路径包括：`~/.local/bin`、`~/.npm-global/bin`、`~/n/bin`、`~/.volta/bin`、`/opt/homebrew/bin`、`/usr/local/bin`、fnm multishells、nvm versions 等

## 约束集

### 硬约束
- [HC-1] macOS 桌面应用（从 Finder/Dock 启动）不继承用户 shell 的 PATH — 来源：macOS 系统行为
- [HC-2] `sh -c` 只使用系统默认 PATH（`/usr/bin:/bin:/usr/sbin:/sbin`），不含 `/usr/local/bin`、`/opt/homebrew/bin` 等 — 来源：macOS 系统行为
- [HC-3] 当前 `try_get_version()` 是唯一的版本检测逻辑，无备选路径扫描 — 来源：代码分析
- [HC-4] `get_single_tool_version()` 在 `spawn_blocking` 中运行，路径扫描同样需在此块内 — 来源：代码分析

### 软约束
- [SC-1] 参考项目使用 `scan_cli_version()` 扫描预定义路径列表 — 来源：cc-switch 代码
- [SC-2] 不同工具可能安装在不同路径（npm 全局、Homebrew、cargo、go 等）— 来源：工具文档
- [SC-3] macOS 上还需考虑 Apple Silicon vs Intel 的 Homebrew 路径差异（`/opt/homebrew/bin` vs `/usr/local/bin`）— 来源：Homebrew 文档

### 依赖关系
- [DEP-1] `tool_version_service.rs` → 前端 `EnvCheckerPanel` 组件：数据结构不变
- [DEP-2] 新增的 `scan_cli_version` 在 `try_get_version` 失败后调用，串行回退

### 风险
- [RISK-1] 路径扫描可能遗漏某些包管理器的路径 — 缓解：覆盖主流方案（npm/Homebrew/nvm/fnm/volta）
- [RISK-2] 扫描过多路径可能导致检测变慢 — 缓解：只检查文件存在性，不执行多余进程

## 成功判据
- [OK-1] macOS 上已安装的 Claude Code / Gemini CLI / OpenCode 能正确检测出版本号
- [OK-2] Windows 上的检测行为不受影响
- [OK-3] Linux 上也能受益于路径扫描
- [OK-4] `cargo check` 编译通过

## 修改范围
仅修改 `src-tauri/src/services/tool_version_service.rs`，前端零改动
