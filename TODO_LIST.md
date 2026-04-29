# 当前任务计划

## 配置导入导出改为数据库真值

- [ ] 后端测试：新增最小测试覆盖 Provider 导出后再导入能写入 SQLite。
  - 验证方式：运行定向 Rust 测试。
  - 当前状态：红灯阶段已确认旧签名无法接收数据库；实现后测试被本机 MSVC `cl.exe` D8037 临时文件错误阻塞，未完成绿灯验证。
- [ ] 后端实现：`export_config` / `import_config` / `export_providers_config` / `import_providers_config` 全部改为读取和写入 SQLite，不再写旧 JSON 文件。
  - 验证方式：定向 Rust 测试通过。
  - 当前状态：代码已实现，等待 Rust 工具链恢复后验证。
- [ ] 命令接线：`utility_commands.rs` 为导入导出命令注入 `AppState`。
  - 验证方式：`cargo check --manifest-path src-tauri/Cargo.toml` 通过。
  - 当前状态：代码已实现；`cargo check` 被本机 MSVC / Windows SDK 环境阻塞。
- [ ] 前端刷新：导入后刷新当前配置状态，避免导入成功后 UI 仍显示旧缓存。
  - 验证方式：`npm run build` 通过。
  - 当前状态：代码已实现；当前 Node 运行项目脚本时触发 `ncrypto::CSPRNG` 断言，构建未完成。
- [ ] 全量验证：完成前运行编译检查。
  - 验证方式：`npm run build` 与 `cargo check --manifest-path src-tauri/Cargo.toml` 通过。
  - 当前状态：`cargo fmt --check` 通过；编译验证受本机工具链环境阻塞。
