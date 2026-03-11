# Team Research: 配置文件迁移到数据库

## 增强后的需求

**目标**：将 `~/.ccg-switch/` 目录下的 JSON 配置文件统一迁移到 SQLite 数据库 (`~/.ccg-switch/ccg-switch.db`)。

**需要迁移的文件**：
| 文件 | 当前用途 | 目标表 |
|------|----------|--------|
| `config.json` | 应用配置（主题、语言、schemaVersion） | `app_configs` |
| `providers.json` | Provider 列表（API Keys、模型配置） | `providers`（扩展现有） |
| `proxy_config.json` | Provider 级别代理配置 | 合并到 `providers` 表 |
| `global-proxy.json` | 全局代理配置 | `global_proxies` |
| `tokens.json` | 旧版 API Keys（已迁移但保留） | 无需迁移，仅兼容 |
| `skill-apps.json` | 技能应用配置 | 合并到 `skills` 或 `app_configs` |

**核心约束**：
1. **向后兼容**：安装升级时必须自动迁移现有 JSON 数据到数据库
2. **幂等性**：迁移逻辑可重复执行，不产生重复数据
3. **原子性**：迁移过程失败时回滚，不破坏原数据
4. **双写过渡**：可选支持，新旧并存一段时间

---

## 约束集合

### 硬约束

**[HC-1] 数据库 Schema 版本管理** — 来源：代码分析
- 当前 `schemaVersion` 在 `config.json` 中维护，值为 2
- 新增表需要递增到版本 3
- 迁移逻辑需检查版本号，只执行一次

**[HC-2] 现有数据库表结构** — 来源：`schema.rs`
- 现有表：`mcp_servers`, `skills`, `skill_repos`, `prompts`
- 新增表需遵循相同命名规范（下划线分隔，复数形式）
- 所有表必须使用 `IF NOT EXISTS` 确保幂等性

**[HC-3] Provider 表扩展需求** — 来源：`provider.rs`
- 当前 Provider 数据在 `providers.json`，不在数据库中
- 需要创建 `providers` 表，字段包括：
  ```sql
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
  in_failover_queue BOOLEAN DEFAULT 0,
  description TEXT,
  tags TEXT, -- JSON 数组
  is_active BOOLEAN NOT NULL,
  created_at INTEGER NOT NULL,
  last_used INTEGER,
  proxy_config TEXT -- JSON 字符串
  ```

**[HC-4] 迁移时机** — 来源：`migration_service.rs`
- 迁移在应用启动时执行（`check_and_run_migration()`）
- 新增迁移需在同一入口调用，保持迁移顺序

**[HC-5] 备份机制** — 来源：`migration_service.rs:backup_legacy_files`
- 迁移前必须备份原始 JSON 文件到 `~/.ccg-switch/backups/`
- 备份文件带时间戳：`tokens.json.bak.YYYYMMDDHHMMSS`

**[HC-6] 文件路径规范** — 来源：代码分析
- 数据目录：`~/.ccg-switch/`
- 数据库路径：`~/.ccg-switch/ccg-switch.db`
- 备份目录：`~/.ccg-switch/backups/`

### 软约束

**[SC-1] JSON 字段命名风格** — 来源：代码分析
- Rust 内部：`snake_case`
- JSON 序列化：`camelCase`（使用 `#[serde(rename = "...")]`）
- 数据库字段：`snake_case`

**[SC-2] 错误处理模式** — 来源：`error.rs`
- 使用 `Result<T, String>` 返回错误
- 错误消息格式：`{操作}: {原因}`

**[SC-3] 服务层模式** — 来源：`mcp_service.rs`, `prompt_service_v2.rs`
- 服务类使用静态方法，接收 `&Arc<Database>`
- DAO 层负责 SQL 操作，Service 层负责业务逻辑

**[SC-4] 配置预览功能** — 来源：`provider_service.rs:preview_provider_sync`
- 部分配置需要支持预览（diff 对比）
- 迁移后需保留预览功能

**[SC-5] skill-apps.json 结构** — 来源：`skill.rs`
- 类型：`HashMap<String, Bool>`（应用名 → 是否启用）
- 用途：记录每个技能在各应用的启用状态
- 迁移策略：合并到 `skills` 表的 `enabled_claude/codex/gemini` 字段

---

## 依赖关系

**[DEP-1] Schema 创建 → DAO 实现**
- 必须先定义表结构，才能实现数据访问层

**[DEP-2] DAO 实现 → Service 层改造**
- Service 层依赖 DAO 提供的方法

**[DEP-3] Service 层 → 命令层改造**
- Tauri 命令调用 Service 层方法

**[DEP-4] 迁移逻辑 → Schema 变更**
- 迁移逻辑需要知道表结构

**[DEP-5] 前端 Store → 命令层**
- 前端调用命令，命令签名变更时需同步更新

---

## 风险

**[RISK-1] 数据丢失风险** — 缓解：迁移前备份 + 幂等性验证
- 迁移过程必须保留原始 JSON 文件至少 7 天
- 提供手动回滚命令

**[RISK-2] 并发写入冲突** — 缓解：数据库事务锁
- 使用 SQLite 事务确保原子性
- 热点表添加 `updated_at` 字段用于乐观锁

**[RISK-3] 升级时 schema 不匹配** — 缓解：版本检查 + 增量迁移
- 每次启动检查 `schemaVersion`
- 只执行版本跨越的迁移脚本

**[RISK-4] JSON → 数据库性能回退** — 缓解：批量操作 + 索引优化
- 大批量写入使用单事务
- 为查询热点添加索引

---

## 成功判据

**[OK-1] 迁移成功验证**
- 升级后数据库中数据与原 JSON 文件一致
- 无重复记录（通过 `SELECT COUNT(*) vs COUNT(DISTINCT id)` 验证）

**[OK-2] 应用功能正常**
- Provider 管理、MCP 服务器、Skills、Prompts 功能正常
- 配置切换后 `~/.claude/settings.json` 正确更新

**[OK-3] 回滚验证**
- 从备份恢复 JSON 文件后，应用可读回配置

**[OK-4] 新安装无影响**
- 全新安装不执行迁移，直接创建数据库表

---

## 开放问题（已解决）

**Q1**: `skill-apps.json` 的具体结构是什么？
→ **A**: 待确认，需要读取该文件样本
→ **约束**: [SC-5] 需补充 skill-apps 结构分析

**Q2**: 是否需要支持从数据库导出回 JSON？
→ **A**: 可选功能，非必需
→ **约束**: 暂不实现

**Q3**: 如何处理迁移过程中程序崩溃？
→ **A**: 迁移脚本使用事务，崩溃后重启可重试
→ **约束**: [HC-7] 迁移必须事务化

---

## 需新增的数据库表

```sql
-- 应用配置表
CREATE TABLE IF NOT EXISTS app_configs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL, -- JSON 字符串
    updated_at INTEGER NOT NULL
);

-- Provider 表（新增，原数据在 providers.json）
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
    custom_params TEXT,
    settings_config TEXT,
    meta TEXT,
    icon TEXT,
    in_failover_queue BOOLEAN NOT NULL DEFAULT 0,
    description TEXT,
    tags TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_used INTEGER,
    proxy_config TEXT
);

-- 全局代理配置表
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

---

## 迁移执行顺序

1. **Schema 层**：`schema.rs` 新增表定义
2. **DAO 层**：新增 `app_configs.rs`, `providers.rs`, `global_proxies.rs`
3. **Service 层**：改造 `config_service.rs`, `provider_service.rs`, `global_proxy_service.rs`
4. **命令层**：更新 Tauri 命令
5. **迁移服务**：`migration_service.rs` 新增 v2→v3 迁移逻辑
6. **前端**：无需变更（命令签名不变）

---

## 上下文使用量

- 当前研究文档：~8KB
- 可用上下文：充足

**下一步**：运行 `/ccg:team-plan config-to-db` 开始规划阶段
