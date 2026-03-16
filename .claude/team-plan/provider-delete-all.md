# Team Plan: Provider 删除全部后数据恢复修复

## 概述

移除 `provider_service.rs` 中两个函数的 JSON 回退迁移逻辑，修复删除全部 Provider 后数据被恢复的 bug。

## 技术方案

**方案**：直接移除 `list_providers_from_db` 和 `list_all_providers_from_db` 中的 JSON 回退代码块。

**理由**：
- `migration_service.rs` 已有完整的 JSON → DB 迁移逻辑（在应用启动时执行）
- `provider_service.rs` 中的回退是冗余的，且导致"删除后恢复"bug
- 移除后，`load_providers_from_json`、`get_providers_path`、`ProvidersConfig` 在 provider_service 中不再需要

## 子任务列表

### Task 1: 移除 JSON 回退迁移逻辑

- **类型**: 后端
- **文件范围**: `src-tauri/src/services/provider_service.rs`
- **依赖**: 无
- **实施步骤**:
  1. `list_providers_from_db`（行 70-88）：移除 `if all.is_empty()` 回退块（行 74-85），保留直接返回
  2. `list_all_providers_from_db`（行 90-108）：移除 `if all.is_empty()` 回退块（行 94-105），保留直接返回
  3. 移除不再使用的 `load_providers_from_json` 函数（行 32-39）
  4. 移除不再使用的 `get_providers_path` 函数（行 19-30）
  5. 清理不再需要的 `use` 导入（`ProvidersConfig` 等）
- **验收标准**:
  - `cargo check` 编译通过
  - 删除全部 Provider 后列表为空

## 文件冲突检查

✅ 无冲突 — 仅修改 1 个文件

## 并行分组

- Layer 1: Task 1（单任务）
