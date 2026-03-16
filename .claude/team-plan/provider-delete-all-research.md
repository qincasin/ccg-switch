# Team Research: Provider 删除全部后数据恢复

## 增强后的需求

**问题描述**：在 Provider 页面逐个删除所有配置时，删除最后一个后，页面恢复显示最后删除的配置（来自旧版 JSON 文件的回退迁移）。

**目标**：修复删除全部 Provider 后数据被 JSON 回退逻辑重新写入数据库的 bug。

**验收标准**：能删除全部 Provider，删除后列表为空，不会被旧数据恢复。

## 根因分析

**`provider_service.rs:91-108`** — `list_all_providers_from_db`:

```rust
pub fn list_all_providers_from_db(db: &Arc<Database>) -> Result<Vec<Provider>, String> {
    let all = db.list_providers()?;

    // 如果数据库为空，尝试从 JSON 文件回退加载
    if all.is_empty() {
        if let Ok(json_providers) = load_providers_from_json() {
            if !json_providers.is_empty() {
                // 将 JSON 数据迁移到数据库
                for provider in &json_providers {
                    let _ = db.upsert_provider(provider);
                }
                return Ok(json_providers);
            }
        }
    }

    Ok(all)
}
```

**Bug 触发链**：
1. 用户删除最后一个 Provider → DB 表为空
2. `deleteProvider` store 调用 `loadAllProviders(true)`
3. `loadAllProviders` → `invoke('get_all_providers')` → `list_all_providers_from_db`
4. `db.list_providers()` 返回空数组 → `all.is_empty()` 为 true
5. 触发 JSON 回退 → `load_providers_from_json()` 从 `~/.ci/claude_switch.json` 读取旧数据
6. 旧数据被 `upsert_provider` 重新写入数据库
7. 返回旧数据给前端 → 页面恢复显示

**同样的问题也存在于 `list_providers_from_db`（行 70-89）**。

## 约束集

### 硬约束

- [HC-1] **JSON 回退迁移不应在每次查询时执行** — 来源：代码分析
  - 迁移是一次性操作（从旧版 JSON 到数据库）
  - 当前实现每次查到空结果都会重新迁移
  - 修复后：迁移只应在首次启动且 DB 为空时执行

- [HC-2] **不能直接删除 JSON 文件** — 来源：安全考虑
  - `~/.ci/claude_switch.json` 可能被其他工具或旧版 claude-switch 使用
  - 应该用迁移标记来控制，而非删除文件

- [HC-3] **迁移标记需要持久化** — 来源：逻辑需求
  - 必须在数据库或配置中记录"已完成迁移"
  - 防止应用重启后再次触发

### 软约束

- [SC-1] **最简修复方案** — 来源：最小化改动
  - 在数据库中添加迁移标记（metadata 表或 provider 表的特殊行），或
  - 在 `~/.ccg-switch/config.json` 中记录标记
  - 推荐：数据库方案（自包含）

## 成功判据

- [OK-1] 删除全部 Provider 后列表为空，不恢复旧数据
- [OK-2] 首次启动时 JSON → DB 迁移仍正常工作
- [OK-3] 迁移完成后重启应用不会再次触发迁移
