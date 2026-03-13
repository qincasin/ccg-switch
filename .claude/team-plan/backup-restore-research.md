# Team Research: 数据库备份与恢复功能

## 增强后的需求

### 目标
在 CCG Switch 设置页面的 advanced tab 中添加数据库备份与恢复功能，包括：
1. **自动备份** - 按用户配置的时间间隔自动备份 SQLite 数据库
2. **手动备份** - "立即备份"按钮
3. **备份列表** - 显示所有备份文件（文件名/日期、大小）
4. **备份操作** - 重命名、删除、恢复
5. **备份策略** - 可配置自动备份间隔和保留数量
6. **自动触发** - 应用启动时检查 + 运行期间后台定时器

### 参考实现
- 来源项目: `C:\guodevelop\demo\cc-switch`
- 核心文件:
  - Rust: `src-tauri/src/database/backup.rs` (完整的备份/恢复逻辑)
  - Rust: `src-tauri/src/settings.rs` (backup_interval_hours, backup_retain_count)
  - Rust: `src-tauri/src/commands/import_export.rs` (list_db_backups, restore_db_backup, rename_db_backup)
  - React: `src/components/settings/BackupListSection.tsx` (备份UI)
  - React: `src/hooks/useBackupManager.ts` (备份hook)
  - React: `src/lib/api/settings.ts` (backupsApi)

## 约束集

### 硬约束
- [HC-1] 数据库路径: `~/.ccg-switch/ccg-switch.db`，Database 使用 `Mutex<Connection>` 模式 — 来源: 代码扫描
- [HC-2] 错误处理使用 `error.rs` 中的 `AppError` 枚举 (thiserror) — 来源: 代码扫描
- [HC-3] 配置存储在 `app_configs` key-value 表（非独立 settings.json），通过 `config_service` 读写 — 来源: 代码扫描
- [HC-4] 前端使用 DaisyUI 4 + TailwindCSS（非 shadcn/ui），需要适配组件风格 — 来源: 代码扫描
- [HC-5] Tauri 命令使用 `Result<T, String>` 返回类型模式 — 来源: 代码扫描
- [HC-6] 备份目录: `~/.ccg-switch/backups/*.db` — 来源: 参考项目模式
- [HC-7] 必须使用 `rusqlite::backup::Backup` 进行一致性快照备份（非文件拷贝） — 来源: 参考项目
- [HC-8] 恢复前必须先创建安全备份，防止数据丢失 — 来源: 参考项目
- [HC-9] 文件名必须验证路径穿越攻击（不允许 `..\`, `/`, `\\`） — 来源: 安全要求
- [HC-10] `chrono` 已在 Cargo.toml 中，可直接使用 — 来源: 依赖检查
- [HC-11] 现有 database `lock_conn!` 宏用于获取连接锁 — 来源: 代码扫描

### 软约束
- [SC-1] 备份面板放在 Settings 的 advanced tab，位于 ImportExportPanel 和 WebDavBackupPanel 之间 — 来源: 用户确认
- [SC-2] 遵循现有命令命名模式：Rust snake_case 函数名，前端 camelCase — 来源: 代码规范
- [SC-3] 所有用户可见字符串使用 i18n（zh.json + en.json） — 来源: 项目规范
- [SC-4] 备份设置（interval, retain_count）存储在 `app_configs` 表中，key 为 `backup_settings` — 来源: HC-3 推导
- [SC-5] UI 风格匹配截图：卡片布局，两列选择器，列表带操作按钮 — 来源: 用户截图
- [SC-6] 自动备份：启动时检查 + 运行期间后台定时器 — 来源: 用户确认
- [SC-7] 需要"删除备份"功能（参考项目没有，需新增） — 来源: 用户确认

### 依赖关系
- [DEP-1] `database/backup.rs` → `database/mod.rs`（扩展 Database impl）
- [DEP-2] 备份 Tauri 命令 → `database/backup.rs`（调用备份方法）
- [DEP-3] `BackupPanel.tsx` → 备份 Tauri 命令（invoke 调用）
- [DEP-4] `lib.rs` 注册 → 新增命令函数
- [DEP-5] 启动时自动备份 → `lib.rs` setup 阶段调用
- [DEP-6] i18n 翻译 → `zh.json` + `en.json` 新增 key

### 风险
- [RISK-1] 备份期间数据库锁持有时间过长（大数据库场景）— 缓解：使用 `rusqlite::backup::Backup` 增量步进，或先快照到内存
- [RISK-2] 恢复操作覆盖当前数据后前端状态不同步 — 缓解：恢复成功后前端需重新加载所有数据
- [RISK-3] 后台定时器需在 Tauri setup 中正确管理生命周期 — 缓解：使用 tokio::spawn 或 std::thread 配合 Arc<Database>

## 成功判据
- [OK-1] 点击"立即备份"后，`~/.ccg-switch/backups/` 目录下生成 `db_backup_YYYYMMDD_HHMMSS.db` 文件
- [OK-2] 备份列表正确显示所有 .db 文件的名称、时间、大小
- [OK-3] 恢复操作后数据库内容变为备份时的状态，且恢复前自动创建安全备份
- [OK-4] 删除操作正确移除指定备份文件
- [OK-5] 重命名操作正确修改备份文件名
- [OK-6] 自动备份间隔和保留数量可通过下拉选择器配置
- [OK-7] 应用启动时自动检查并执行到期备份
- [OK-8] 运行期间后台定时器按间隔执行自动备份
- [OK-9] 备份数量超过保留上限时自动清理最旧的备份
- [OK-10] 编译通过，无 Rust 编译错误

## 实施模块清单

### Rust 后端
| 文件 | 操作 | 说明 |
|------|------|------|
| `src-tauri/src/database/backup.rs` | 新建 | 备份核心逻辑（BackupEntry, backup_database_file, list_backups, restore_from_backup, rename_backup, delete_backup, periodic_backup_if_needed, cleanup_db_backups） |
| `src-tauri/src/database/mod.rs` | 修改 | 添加 `mod backup;` |
| `src-tauri/src/commands/backup_commands.rs` | 新建 | Tauri 命令：list_db_backups, create_db_backup, restore_db_backup, rename_db_backup, delete_db_backup, get_backup_settings, save_backup_settings |
| `src-tauri/src/commands/mod.rs` | 修改 | 添加 `pub mod backup_commands;` |
| `src-tauri/src/lib.rs` | 修改 | 注册命令 + setup 阶段启动自动备份 |

### React 前端
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/settings/BackupPanel.tsx` | 新建 | 备份面板 UI（间隔/保留选择器、备份列表、操作按钮） |
| `src/pages/Settings.tsx` | 修改 | advanced tab 中引入 BackupPanel |
| `src/locales/zh.json` | 修改 | 新增备份相关中文翻译 |
| `src/locales/en.json` | 修改 | 新增备份相关英文翻译 |

## 开放问题（已解决）
- Q1: 备份功能放哪个 tab？ → A: advanced tab → 约束 [SC-1]
- Q2: 是否需要删除功能？ → A: 需要 → 约束 [SC-7]
- Q3: 自动备份触发时机？ → A: 启动时检查 + 后台定时器 → 约束 [SC-6]
