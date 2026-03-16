# Team Plan: macOS Dock 图标无法唤起窗口

## 概述

修复 macOS 下点击 ❌ 关闭窗口后，dock 图标无法唤起程序的问题。通过添加 `RunEvent::Reopen` 处理器响应 dock 点击事件。

## 多模型分析说明

本次改动仅涉及 1 个 Rust 文件、~15 行代码，无前端组件。研究阶段已通过 Tauri 2 源码验证 API 可用性，跳过多模型分析。

## 技术方案

**根因**：`lib.rs:858` 使用 `Builder::run()` 简化模式（内部等价于 `build().run(|_,_|{})`），无法处理 macOS 的 `RunEvent::Reopen` 事件。

**方案**：将 `Builder::run()` 改为 `Builder::build()` + `App::run(callback)`，在回调中处理 `RunEvent::Reopen`，当 dock 图标被点击且无可见窗口时，显示主窗口。

**关键约束**：
- `RunEvent::Reopen` 带有 `#[cfg(target_os = "macos")]`，需条件编译
- 现有 `window.hide()` 行为和 tray 功能保持不变
- Windows/Linux 不受影响

## 子任务列表

### Task 1: 添加 macOS Dock Reopen 事件处理

- **类型**: 后端
- **文件范围**: `src-tauri/src/lib.rs`
- **依赖**: 无
- **实施步骤**:
  1. 定位 `lib.rs:652` 的 `pub fn run()` 函数
  2. 将末尾的 `.run(tauri::generate_context!()).expect(...)` (行 858-859) 替换为：
     ```rust
     .build(tauri::generate_context!())
     .expect("error while building tauri application")
     .run(|app_handle, event| {
         // macOS: 点击 dock 图标时恢复隐藏的窗口
         #[cfg(target_os = "macos")]
         if let tauri::RunEvent::Reopen { has_visible_windows, .. } = event {
             if !has_visible_windows {
                 if let Some(window) = app_handle.get_webview_window("main") {
                     let _ = window.show();
                     let _ = window.set_focus();
                 }
             }
         }
     });
     ```
  3. 注意：`pub fn run()` 函数的返回类型不需要改变（原来 `.run()` 返回 `Result`，用 `.expect()` 消费；新模式 `.build()` 返回 `Result`，`.expect()` 得到 `App`，`.run()` 无返回值）
- **验收标准**:
  - `cargo check` 编译通过（Windows 环境）
  - macOS 下点击 ❌ 后 dock 图标可唤起窗口
  - Windows/Linux 行为不变

## 文件冲突检查

✅ 无冲突 — 仅修改 1 个文件

## 并行分组

- Layer 1: Task 1（单任务，无需并行）

## 验证计划

1. **编译验证**: `cargo check`（Windows 即可验证语法和类型）
2. **macOS 验证**: 构建 macOS 版本后测试：
   - 点击 ❌ → 窗口隐藏 → 点击 dock 图标 → 窗口恢复 ✓
   - 点击最小化 → 点击 dock 图标 → 窗口恢复 ✓（不受影响）
   - 点击 tray 图标 → 窗口恢复 ✓（不受影响）
