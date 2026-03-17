# Team Plan: autolaunch-lag

## 概述
采用 `auto-launch` crate（参考 cc-switch 项目）替换手动 `reg.exe` 调用，并将命令改为 async，消除设置页开机自启动检测导致的 Tab 切换卡顿。

## Codex 分析摘要（Research 阶段）
- 根因：`get_auto_launch_status` 是同步 Tauri 命令，内部 `std::process::Command` 调用 `reg.exe` 阻塞主线程
- 仅改 async 签名不够，必须将阻塞操作移出主线程
- 仓库已有 `spawn_blocking` 惯例（tool_version_service、mcp_status_service）
- 保持 `AutoLaunchStatus { enabled, supported }` 返回结构不变
- 注册表键名兼容性：当前硬编码 `CCSwitch`，需处理旧键名

## 技术方案

**采用方案 3（auto-launch crate）**，对标参考项目 cc-switch：
1. 引入 `auto-launch = "0.5"` 依赖
2. 重写 `auto_launch_service.rs`，使用 `AutoLaunchBuilder` 跨平台 API
3. 命令层改为 `async`，服务层阻塞操作用 `spawn_blocking` 包裹
4. 前端零改动（已经是 async invoke 调用）
5. 处理旧注册表键名 `CCSwitch` 的迁移/清理

### 与参考项目的差异点
| 方面 | cc-switch | 本项目（目标） |
|------|-----------|---------------|
| app_name | `"CC Switch"` | `"CCG Switch"` |
| 返回值 | `bool` | `AutoLaunchStatus { enabled, supported }` |
| 所有平台 supported | 是 | 是（auto-launch crate 天然跨平台） |
| 旧键名迁移 | 无 | 需迁移 `CCSwitch` → `CCG Switch` |

## 子任务列表

### Task 1: 添加 auto-launch 依赖
- **类型**: 后端
- **文件范围**: `src-tauri/Cargo.toml`
- **依赖**: 无
- **实施步骤**:
  1. 在 `[dependencies]` 中添加 `auto-launch = "0.5"`
- **验收标准**: `cargo check` 编译通过

### Task 2: 重写 auto_launch_service.rs
- **类型**: 后端
- **文件范围**: `src-tauri/src/services/auto_launch_service.rs`
- **依赖**: Task 1
- **实施步骤**:
  1. 引入 `auto_launch::{AutoLaunch, AutoLaunchBuilder}`
  2. 实现 `get_auto_launch()` 函数，参考 cc-switch 的实现：
     - app_name 使用 `"CCG Switch"`
     - macOS 处理 `.app` bundle 路径
     - 其他平台使用 `current_exe()` 路径
  3. 重写 `get_auto_launch_status()` 为 `async`：
     - 使用 `tokio::task::spawn_blocking` 包裹 `is_enabled()` 调用
     - 所有平台都返回 `supported: true`（auto-launch 天然跨平台）
     - 错误时返回 `supported: false, enabled: false`
  4. 重写 `set_auto_launch(enabled)` 为 `async`：
     - 使用 `spawn_blocking` 包裹 `enable()/disable()` 调用
  5. 添加旧注册表键名清理：Windows 下尝试删除旧的 `CCSwitch` 注册表项
  6. 移除所有 `#[cfg(target_os = "windows")]` 条件编译和手动 `reg.exe` 调用
- **验收标准**: `cargo check` 编译通过，API 签名兼容

### Task 3: 更新命令层为 async
- **类型**: 后端
- **文件范围**: `src-tauri/src/commands/advanced_commands.rs`
- **依赖**: Task 2
- **实施步骤**:
  1. 将 `get_auto_launch_status` 改为 `pub async fn`
  2. 将 `set_auto_launch` 改为 `pub async fn`
  3. 内部调用改为 `.await` 形式
- **验收标准**: `cargo check` 编译通过

## 文件冲突检查
✅ 无冲突 — 三个任务分别修改不同文件，Task 2/3 依赖 Task 1 串行

## 并行分组
- Layer 1: Task 1（添加依赖）
- Layer 2 (依赖 Layer 1): Task 2 + Task 3（可合并为单次执行，因改动关联紧密）

## 注意事项
- `AutoLaunchStatus` 结构体保持不变，前端无需修改
- `lib.rs` 的 `generate_handler!` 无需修改（同步/异步命令统一注册）
- 前端 `advancedService.ts` 和 `Settings.tsx` 无需修改
