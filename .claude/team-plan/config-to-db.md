# Team Plan: Config-to-DB Migration

## 概述

将 `~/.ccg-switch/` 目录下的 JSON 配置文件统一迁移到 SQLite 数据库 (`~/.ccg-switch/ccg-switch.db`)，实现配置存储的数据库化，提升数据一致性、事务安全性和可扩展性。

---

## Codex 分析摘要

### 关键技术发现

1. **语义不匹配问题**：
   - `proxy_config.json` 实际是**本地代理服务器配置**（port/host/enabled/takeoverMode），非 Provider 级别代理
   - Provider 级别代理已在 `providers.json` 的 `proxyConfig` 字段中
   - `skill-apps.json` 是 Legacy skills 的 per-app 开关，与 v2 `skills` 表（已安装技能）是两套系统

2. **启动顺序问题**：
   - 当前 `.setup()` 先执行 `check_and_run_migration()` 再 `Database::init()`
   - DB 迁移需要 `Arc<Database>`，需要调整调用顺序

3. **推荐方案**：DB 成为 SSOT（Single Source of Truth）
   - 迁移后业务读写以 DB 为准，JSON 仅用于备份
   - 需要改动命令层与服务层签名

### 推荐架构（精确到文件）

| 层级 | 文件 | 职责 |
|------|------|------|
| Schema | `schema.rs:create_tables()` | 新增 `app_configs`, `providers`, `global_proxies` 表 |
| DAO | `dao/app_configs.rs` | `get_app_config(key)`, `set_app_config(key,value)` |
| DAO | `dao/providers.rs` | `list_providers`, `upsert_provider`, `delete_provider` |
| DAO | `dao/global_proxies.rs` | `get_global_proxy_row`, `upsert_global_proxy_row` |
| Migration | `migration_service.rs` | v2→v3 迁移逻辑（事务化 + 备份） |
| Service | `config_service.rs` | 切换到 DB 读写 |
| Service | `provider_service.rs` | 切换到 DB 读写 |
| Service | `global_proxy_service.rs` | 切换到 DB 读写 |

---

## Gemini 分析摘要

### 前端影响评估

**结论**：前端无需变更（命令签名保持不变）

| Store | 状态 |
|-------|------|
| `useConfigStore` | 无需变更（Tauri 命令签名不变） |
| `useProviderStore` | 无需变更（Tauri 命令签名不变） |
| `useProxyStore` | 无需变更（Tauri 命令签名不变） |
| `useSkillStoreV2` | 无需变更（Tauri 命令签名不变） |

### UI/UX 建议

1. **无缝迁移**：用户应感觉不到迁移发生，所有配置保持完整
2. **错误恢复**：如迁移失败，提供清晰的 "Migration Error" 状态和重试选项
3. **数据完整性**：SQLite ACID 特性比 JSON 更可靠（避免写入崩溃导致损坏）

---

## 技术方案

### 数据库 Schema（新增 3 张表）

```sql
-- 应用配置表（key-value 存储）
CREATE TABLE IF NOT EXISTS app_configs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL, -- JSON 字符串
    updated_at INTEGER NOT NULL
);

-- Provider 表
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    app_type TEXT NOT NULL,
    api_key TEXT NOT NULL,
    url TEXT,
    default_sonnet_model TEXT,
    default_opus_model TEXT,
    default_haiku_model TEXT,
    default_reasoning_model TEXT,
    custom_params TEXT, -- JSON 字符串
    settings_config TEXT, -- JSON 字符串
    meta TEXT, -- JSON 字符串
    icon TEXT,
    in_failover_queue BOOLEAN NOT NULL DEFAULT 0,
    description TEXT,
    tags TEXT, -- JSON 数组
    is_active BOOLEAN NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_used INTEGER,
    proxy_config TEXT -- JSON 字符串
);

-- 全局代理配置表（单行表）
CREATE TABLE IF NOT EXISTS global_proxies (
    id TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT 0,
    http_proxy TEXT,
    https_proxy TEXT,
    socks5_proxy TEXT,
    no_proxy TEXT,
    updated_at INTEGER NOT NULL
);
```

### 迁移策略

| 决策点 | 方案 |
|--------|------|
| proxy_config.json | 存入 `app_configs` 的 key `proxy_server_config` |
| skill-apps.json | 保留 Legacy，单独存 `app_configs` 的 key `skill_apps_legacy` |
| 迁移时机 | 应用启动时 `.setup()` 中执行 |
| 事务边界 | DB 写入在 transaction 内，备份在 transaction 外 |
| 备份保留 | `~/.ccg-switch/backups/<timestamp>/` 保留 7 天 |

### 实施阶段

```
Phase 1: Schema + DAO（后端）
   ↓
Phase 2: Migration Service（后端）
   ↓
Phase 3: Service 层切换（后端，按模块逐个切）
   ↓
Phase 4: 命令层改造（后端）
```

---

## 子任务列表

### Task 1: Schema 创建（后端）
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/database/schema.rs`
- **依赖**: 无
- **实施步骤**:
  1. 在 `create_tables()` 函数中新增 3 张表的 CREATE TABLE 语句
  2. 所有表使用 `IF NOT EXISTS` 确保幂等
  3. 添加 `updated_at` 字段用于乐观锁
- **验收标准**:
  - 应用启动后数据库包含新表
  - 多次启动不会产生重复表

### Task 2: DAO 层实现（后端）
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/database/dao/mod.rs`
  - `src-tauri/src/database/dao/app_configs.rs`（新建）
  - `src-tauri/src/database/dao/providers.rs`（新建）
  - `src-tauri/src/database/dao/global_proxies.rs`（新建）
- **依赖**: Task 1
- **实施步骤**:
  1. 在 `dao/mod.rs` 中导出新模块
  2. 实现 `app_configs.rs`：`get_app_config(key)`, `set_app_config(key, value)`
  3. 实现 `providers.rs`：`list_providers()`, `get_provider(id)`, `upsert_provider()`, `delete_provider()`
  4. 实现 `global_proxies.rs`：`get_global_proxy()`, `upsert_global_proxy()`
  5. 遵循现有 DAO 模式（使用 `lock_conn!` 宏，`INSERT OR REPLACE`）
- **验收标准**:
  - DAO 单元测试通过
  - 能正确读写数据库

### Task 3: Migration Service 改造（后端）
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/services/migration_service.rs`
- **依赖**: Task 1, Task 2
- **实施步骤**:
  1. 新增 `backup_files_for_v3()` 函数：备份 5 个 JSON 文件到 `~/.ccg-switch/backups/<timestamp>/`
  2. 新增 `migrate_v2_to_v3(&Database)` 函数：
     - 开启 transaction
     - 读取 `config.json`, `providers.json`, `global-proxy.json`, `proxy_config.json`, `skill-apps.json`
     - 调用 DAO 写入数据库
     - 提交 transaction
  3. 在 `check_and_run_migration()` 中增加 v2→v3 分支
  4. 迁移成功后更新 `config.json` 的 `schemaVersion` 为 3
- **验收标准**:
  - 升级安装后数据完整迁移到 DB
  - 全新安装不执行迁移
  - 迁移失败能回滚

### Task 4: Config Service 切换（后端）
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/services/config_service.rs`
  - `src-tauri/src/commands/utility_commands.rs`
- **依赖**: Task 2, Task 3
- **实施步骤**:
  1. 改造 `load_config()` 和 `save_config()` 接收 `&Arc<Database>`
  2. 改为从 `app_configs` 表读取/写入
  3. 更新 `utility_commands.rs` 中的 `get_config`/`save_config` 命令
  4. 添加 `AppState` 依赖
- **验收标准**:
  - 前端设置页面功能正常
  - 主题/语言切换正常

### Task 5: Global Proxy Service 切换（后端）
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/services/global_proxy_service.rs`
- **依赖**: Task 2, Task 3
- **实施步骤**:
  1. 改造 `get_global_proxy()` 和 `set_global_proxy()` 接收 `&Arc<Database>`
  2. 改为从 `global_proxies` 表读取/写入
  3. 更新相关命令层
- **验收标准**:
  - 前端代理设置功能正常
  - 代理配置能正确保存和读取

### Task 6: Provider Service 切换（后端）
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/services/provider_service.rs`
  - `src-tauri/src/commands/provider_commands.rs`
- **依赖**: Task 2, Task 3
- **实施步骤**:
  1. 创建 `ProviderServiceV2`（或改造现有 service）
  2. 所有 CRUD 操作改为使用 DAO
  3. 保留同步到外部配置文件的逻辑（`~/.claude/settings.json`, `.codex/auth.json`, `.gemini/.env`）
  4. 更新 `provider_commands.rs` 中的命令
- **验收标准**:
  - Provider 管理页面功能正常
  - 配置切换后外部文件正确更新
  - 预览/同步功能正常

### Task 7: Proxy Config 迁移（后端）
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/services/proxy_service.rs`
- **依赖**: Task 2, Task 3
- **实施步骤**:
  1. 改造读写逻辑存入 `app_configs` 的 `proxy_server_config` key
  2. 更新相关命令
- **验收标准**:
  - 代理服务配置功能正常
  - 代理启停正常

### Task 8: Skill Apps 迁移（后端）
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/services/skill_service.rs`
  - `src-tauri/src/commands/skill_commands.rs`
- **依赖**: Task 2, Task 3
- **实施步骤**:
  1. 迁移时保留 `skill-apps.json` 数据到 `app_configs` 的 `skill_apps_legacy` key
  2. 如果决定下线 Legacy，则映射到 `skills.enabled_*` 字段
- **验收标准**:
  - Legacy skills 开关功能正常
  - 已安装技能开关正常

### Task 9: lib.rs 启动顺序调整（后端）
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/lib.rs`
- **依赖**: Task 3
- **实施步骤**:
  1. 调整 `.setup()` 中的调用顺序
  2. 先 `Database::init()` 再执行 DB 迁移
- **验收标准**:
  - 应用正常启动
  - 迁移正确执行

---

## 文件冲突检查

所有任务的文件范围已明确隔离：

| 任务 | 文件路径 | 冲突检查 |
|------|----------|----------|
| Task 1 | `schema.rs` | ✅ 独占 |
| Task 2 | `dao/mod.rs`, 3 个新文件 | ✅ 独占 |
| Task 3 | `migration_service.rs` | ✅ 独占 |
| Task 4 | `config_service.rs`, `utility_commands.rs` | ✅ 独占 |
| Task 5 | `global_proxy_service.rs` | ✅ 独占 |
| Task 6 | `provider_service.rs`, `provider_commands.rs` | ✅ 独占 |
| Task 7 | `proxy_service.rs` | ✅ 独占 |
| Task 8 | `skill_service.rs`, `skill_commands.rs` | ✅ 独占 |
| Task 9 | `lib.rs` | ✅ 独占 |

---

## 并行分组

```
Layer 1 (并行): Task 1 (Schema), Task 2 (DAO - 部分)
                    ↓
Layer 2 (依赖 L1): Task 2 (DAO - 完成)
                    ↓
Layer 3 (依赖 L2): Task 3 (Migration)
                    ↓
Layer 4 (并行，依赖 L3): Task 4, Task 5, Task 6, Task 7, Task 8
                    ↓
Layer 5 (依赖 L4): Task 9 (启动顺序调整，可提前到 L3 后)
```

**推荐执行顺序**:
1. Layer 1-2: Task 1 → Task 2（基础架构）
2. Layer 3: Task 3（迁移逻辑）
3. Layer 4: Task 4 → Task 5 → Task 6 → Task 7 → Task 8（服务切换，可并行）
4. Layer 5: Task 9（启动顺序调整）

---

## 成功判据（来自 Research）

- [OK-1] 升级后数据库中数据与原 JSON 文件一致
- [OK-2] Provider 管理、MCP 服务器、Skills、Prompts 功能正常
- [OK-3] 从备份恢复 JSON 文件后，应用可读回配置
- [OK-4] 全新安装不执行迁移，直接创建数据库表

---

## 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| 数据丢失 | 迁移前备份 + DB transaction + schemaVersion 仅在成功后更新 |
| 数据不一致 | DB 为唯一写入源，JSON 仅读取不写入 |
| 迁移时序问题 | 调整 `.setup()` 调用顺序，先 init DB 再迁移 |
| Legacy skills 混淆 | 保留 `skill_apps_legacy` 独立存储 |

---

## Builder 分配建议

| Builder | 负责任务 |
|---------|----------|
| Builder 1 (Rust) | Task 1, Task 2, Task 3 |
| Builder 2 (Rust) | Task 4, Task 5, Task 7 |
| Builder 3 (Rust) | Task 6, Task 8, Task 9 |

---

## 下一步

计划已就绪，运行 `/ccg:team-exec config-to-db` 开始并行实施
