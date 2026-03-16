# Team Research: macOS Dock 图标无法唤起窗口

## 增强后的需求

**问题描述**：macOS 版本下，点击窗口关闭按钮（❌）后，dock 栏图标无法唤起程序窗口，只能通过状态栏（system tray）唤起。只有点击最小化按钮才能通过 dock 正常唤起。

**目标**：修复 macOS 下点击 ❌ 关闭窗口后，点击 dock 图标能重新显示窗口。

**技术上下文**：
- 应用使用 Tauri 2.10.2
- 当前行为：`CloseRequested` 事件中调用 `window.hide()` 隐藏窗口
- macOS 的 `window.hide()` 使窗口不可见，但 dock 点击不会自动恢复隐藏的窗口
- macOS 的 dock 点击对应 `NSApplicationDelegate.applicationShouldHandleReopen:hasVisibleWindows:` 委托

## 根因分析

### 当前代码

**`lib.rs:851-859`** — 窗口关闭事件处理：
```rust
.on_window_event(|window, event| {
    // 点击 X 按钮时隐藏窗口到托盘，而不是退出进程
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
})
.run(tauri::generate_context!())
.expect("error while running tauri application");
```

**问题**：
1. `window.hide()` 在 macOS 上隐藏窗口后，窗口既不在前台也不在 dock 的最小化列表中
2. 当前使用 `Builder::run()` 简化模式，**无法接收 `RunEvent` 回调**
3. Tauri 2 的 `RunEvent::Reopen`（对应 macOS `applicationShouldHandleReopen`）未被处理
4. 因此点击 dock 图标时，macOS 发出 reopen 事件但应用没有响应

**为什么最小化可以**：`window.minimize()` 将窗口放入 dock 最小化列表，macOS 原生支持点击 dock 图标 unminimize。

**为什么状态栏可以**：`tray.rs:55-63` 显式处理了 `TrayIconEvent::Click`，调用 `show_main_window()` 恢复窗口。

## 约束集

### 硬约束

- [HC-1] **必须使用 `Builder::build()` + `App::run()` 模式** — 来源：Tauri 2 API
  - `Builder::run()` 内部实现是 `self.build(context)?.run(|_, _| {})` —— 空回调
  - 要处理 `RunEvent::Reopen`，必须切换到显式 `App::run(callback)` 模式
  - 参考：`tauri-2.10.2/src/app.rs:2298-2301`

- [HC-2] **`RunEvent::Reopen` 仅在 macOS 可用** — 来源：Tauri 2 源码
  - 声明带有 `#[cfg(target_os = "macos")]` 条件编译
  - 匹配时需要同样的条件编译注解
  - 参考：`tauri-2.10.2/src/app.rs:247-254`

- [HC-3] **`on_window_event` 中的 `window.hide()` 行为不能改变** — 来源：功能需求
  - Windows/Linux 上 `window.hide()` + 系统托盘是标准行为，不受影响
  - macOS 上也需要保留隐藏到托盘的功能
  - 解决方案是**增加** dock reopen 处理，而非修改关闭行为

- [HC-4] **现有 `setup` 闭包和 `on_window_event` 链式调用必须保留** — 来源：代码结构
  - `lib.rs` 中 Builder 链式调用注册了大量插件和命令
  - 修改仅涉及末尾 `.run()` 改为 `.build()` + `.run()`

### 软约束

- [SC-1] **复用 `tray::show_main_window()` 函数** — 来源：代码复用
  - `tray.rs:22-28` 已有 `show_main_window()` 函数
  - 需要将其改为 `pub` 或在 `lib.rs` 中直接实现相同逻辑

- [SC-2] **保持跨平台兼容** — 来源：多平台支持
  - Reopen 处理只在 macOS 编译，不影响 Windows/Linux
  - 使用 `#[cfg(target_os = "macos")]` 条件编译

### 依赖关系

- [DEP-1] `lib.rs` → `tray.rs`：如果复用 `show_main_window()`，需要调整可见性

### 风险

- [RISK-1] **`Builder::run()` → `Builder::build()` + `App::run()` 的行为差异** — 缓解：Tauri 源码确认两者等价（`run` 内部就是 `build + run(empty callback)`），仅增加回调处理

## 成功判据

- [OK-1] macOS 下点击 ❌ 关闭窗口后，点击 dock 图标能重新显示窗口
- [OK-2] macOS 下状态栏（tray）唤起功能不受影响
- [OK-3] Windows/Linux 下行为完全不变
- [OK-4] 代码编译通过（所有平台）

## 修改范围

| 文件 | 修改内容 | 行数估计 |
|------|----------|----------|
| `src-tauri/src/lib.rs` | `.run()` → `.build()` + `.run()` + Reopen handler | ~15 行 |
| `src-tauri/src/tray.rs` | `show_main_window` 改为 `pub`（可选） | 1 行 |

## 实施方案预览

```rust
// lib.rs 末尾，从原来的：
//   .run(tauri::generate_context!())
//   .expect("error while running tauri application");
// 改为：

let app = tauri::Builder::default()
    // ... 所有插件、setup、on_window_event 保持不变 ...
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

app.run(|app_handle, event| {
    #[cfg(target_os = "macos")]
    if let tauri::RunEvent::Reopen { has_visible_windows, .. } = event {
        if !has_visible_windows {
            // dock 图标被点击且无可见窗口 → 显示主窗口
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }
});
```

## 开放问题（已解决）

- Q1: 是否需要改变 ❌ 按钮在 macOS 上的行为（hide vs minimize）？
  → 不需要，保持 hide 行为 + 添加 Reopen handler 是更优方案
- Q2: `Builder::run()` 和 `Builder::build() + App::run()` 是否完全等价？
  → 是，源码确认 `run` 内部就是 `build(context)?.run(|_, _| {})`
