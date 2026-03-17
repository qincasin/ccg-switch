# Team Research: autolaunch-lag

## 增强后的需求

**问题**：设置页面的"开机自启动"状态检测 (`get_auto_launch_status`) 导致 Tab 切换卡顿 1-2 秒。

**根因**：
1. Rust 端 `get_auto_launch_status` 是**同步 Tauri 命令**（无 `async`），内部通过 `std::process::Command` 调用 `reg.exe` 查询注册表，阻塞 Tauri 主线程
2. 前端 `Settings.tsx` 在 `useEffect([], [])` 中调用，页面 mount 时立即发起。由于已改为 CSS hidden（所有 Tab 组件同时 mount），此调用在设置页首次渲染时就会阻塞

**参考项目**（`C:\guodevelop\demo\cc-switch`）的做法：
- 后端命令声明为 `pub async fn get_auto_launch_status()` — 异步非阻塞
- 使用 `auto-launch` crate 替代手动调用 `reg.exe`
- 前端将 `launchOnStartup` 作为 Settings 数据的一个字段，通过 react-query 统一加载
- 不单独发起 auto-launch 状态检测请求

**目标**：消除开机自启动检测对 Tab 切换的阻塞

## 约束集

### 硬约束
- [HC-1] Tauri 同步命令（无 `async`）在主线程执行，`std::process::Command` 会阻塞 UI 渲染 — 来源：Tauri 文档 + 代码分析
- [HC-2] `reg.exe` 进程创建在 Production 环境下因杀毒软件扫描会更慢（500ms-2s）— 来源：之前的 Settings tab 卡顿研究
- [HC-3] 当前项目使用 CSS hidden 模式，所有 Tab 组件在设置页进入时同时 mount — 来源：`Settings.tsx` 之前的修改
- [HC-4] `auto_launch_service.rs` 的 `check_auto_launch_enabled()` 和 `set_auto_launch()` 都调用 `reg.exe` — 来源：代码分析

### 软约束
- [SC-1] 参考项目使用 `auto-launch` crate（跨平台支持更好），但当前项目只需 Windows 注册表检测 — 来源：参考项目对比
- [SC-2] 最小改动原则：将命令改为 async 即可解决阻塞问题，无需引入新 crate — 来源：代码分析
- [SC-3] 前端加载时可显示 loading 状态，不需要阻塞整个 Tab — 来源：UX 最佳实践

### 依赖关系
- [DEP-1] `advanced_commands.rs` → `auto_launch_service.rs`：命令层调用服务层
- [DEP-2] `lib.rs` → `advanced_commands`：命令注册
- [DEP-3] `advancedService.ts` → `advanced_commands`：前端调用后端

### 风险
- [RISK-1] 将同步命令改为 async 需要确认 Tauri 的 `#[tauri::command]` 对 async 的支持 — 缓解：Tauri 2 原生支持 async command，参考项目已验证
- [RISK-2] `set_auto_launch` 同样是同步命令调用 `reg.exe`，应一并改为 async — 缓解：在同一次修改中处理

## 成功判据
- [OK-1] 切换到设置页时，Tab 可立即响应点击，无可感知的卡顿
- [OK-2] 开机自启动状态正确显示（toggle 状态与注册表一致）
- [OK-3] 切换开机自启动 toggle 时，操作流畅无卡顿
- [OK-4] `cargo check` 编译通过，`npx tsc --noEmit` 无错误

## Codex 深度分析补充

### 关键洞察
1. 仅改命令签名为 `async` 不够 — 如果内部仍同步执行 `reg.exe`，只是从主线程移到 Tauri async 运行线程，不能稳定消除卡顿
2. 仓库已有 `spawn_blocking` 惯例：`tool_version_service.rs` 和 `mcp_status_service.rs` 已采用此模式
3. 保持 `AutoLaunchStatus { enabled, supported }` 返回结构，不改为参考项目的 `bool` 返回

### 三种方案对比
| 方案 | 改动量 | 彻底性 | 风险 |
|------|--------|--------|------|
| 1. `spawn_blocking` 包裹 `reg.exe` | 最小 | 中等（仍有进程创建开销） | 低 |
| 2. 改用 `winreg` crate 直接读注册表 | 中等 | 高（去除外部进程） | 中（新依赖） |
| 3. 引入 `auto-launch` crate | 最大 | 最高（跨平台） | 高（命名兼容、行为扩大） |

### 注册表兼容性
- 当前硬编码键名 `CCSwitch`
- 参考项目使用 `CC Switch`（通过 `auto-launch` crate）
- 本项目 `productName` 是 `CCG Switch`
- 任何方案变更都需保持旧键名兼容

## 开放问题（待用户确认）
- Q1: 选择哪种方案？方案 1 最安全最小改动，方案 2 更彻底但需引入 `winreg` 依赖
- Q2: `set_auto_launch` 是否一并改为异步？（建议一并处理）

## 推荐方案

**方案 1（最小改动 + spawn_blocking）**：
1. `advanced_commands.rs`：将 `get_auto_launch_status` 和 `set_auto_launch` 改为 `async`
2. `auto_launch_service.rs`：将 `check_auto_launch_enabled()` 和 `set_auto_launch()` 内的 `reg.exe` 调用用 `tokio::task::spawn_blocking` 包裹
3. 前端无需修改（已经是 async invoke 调用）
4. 遵循仓库现有 `spawn_blocking` 惯例（tool_version_service、mcp_status_service）
