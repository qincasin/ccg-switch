# Team Plan: backup-restore

## 概述
为 CCG Switch 设置页面的 Advanced tab 添加 SQLite 数据库备份与恢复功能，包括手动备份、自动备份、备份列表管理（恢复/删除/重命名）和备份策略配置。

## Codex 分析摘要
- **技术可行性**: 高。代码库已有 `app_configs`、`AppError`、`lock_conn!` 宏、`rusqlite::backup::Backup` 支持
- **推荐方案**: 使用 `rusqlite::backup::Backup` 生成 `.db` 文件一致性快照（方案 A）
- **架构**: `database/backup.rs` 实现核心逻辑（impl Database），`commands/backup_commands.rs` 封装 Tauri 命令
- **数据结构**: `BackupEntry`（filename, size_bytes, created_at）+ `BackupSettings`（interval_hours, retain_count）存于 `app_configs` 表
- **自动备份**: `lib.rs` setup 中触发首次检查 + `tauri::async_runtime::spawn` 后台定时循环
- **风险缓解**: 路径穿越校验 + 恢复前安全备份 + 并发互斥锁

## Gemini 分析摘要
- **布局方案**: 卡片容器，两栏配置区（间隔+保留数量）→ 立即备份按钮 → 备份列表区（max-h-[300px] overflow-y-auto）
- **组件方案**: 单文件 `BackupPanel.tsx`，使用现有 `ModalDialog` 做确认弹窗
- **交互设计**: 内联重命名（Input + Check/X 图标）、恢复/删除用 ModalDialog 确认、Loader2 loading 状态
- **i18n**: `settings.backup.*` 命名空间
- **类型/服务**: 类型加入 `types/advanced.ts`，invoke 封装加入 `services/advancedService.ts`
- **可访问性**: ESC 关闭弹窗、Enter 提交重命名、aria-label、truncate 长文件名

## 技术方案

### 后端 (Codex 权威)
1. **备份核心** (`database/backup.rs`):
   - `BackupEntry` 和 `BackupSettings` 数据结构（`#[serde(rename_all = "camelCase")]`）
   - 备份目录: `~/.ccg-switch/backups/`
   - 文件名格式: `db_backup_YYYYMMDD_HHMMSS.db`
   - 使用 `rusqlite::backup::Backup` 做一致性快照
   - 路径穿越校验: 拒绝 `..`、`/`、`\\`
   - 设置存储: `app_configs` 表 key=`backup_settings`

2. **核心函数签名**:
   ```rust
   impl Database {
       pub fn create_db_backup(&self) -> Result<BackupEntry, AppError>
       pub fn list_db_backups() -> Result<Vec<BackupEntry>, AppError>  // 静态方法
       pub fn restore_db_backup(&self, filename: &str) -> Result<String, AppError>
       pub fn delete_db_backup(filename: &str) -> Result<(), AppError>  // 静态方法
       pub fn rename_db_backup(old_name: &str, new_name: &str) -> Result<(), AppError>
       pub fn get_backup_settings(&self) -> Result<BackupSettings, AppError>
       pub fn save_backup_settings(&self, settings: &BackupSettings) -> Result<(), AppError>
       pub fn periodic_backup_if_needed(&self) -> Result<bool, AppError>
       fn cleanup_db_backups(dir: &Path, retain: usize) -> Result<(), AppError>
       fn validate_backup_filename(name: &str) -> Result<(), AppError>
       fn get_backups_dir() -> Result<PathBuf, AppError>
   }
   ```

3. **Tauri 命令** (`commands/backup_commands.rs`):
   - 7 个命令，统一 `Result<T, String>` 返回
   - 需要 `State<AppState>` 的: create_db_backup, restore_db_backup, get_backup_settings, save_backup_settings
   - 不需要 state 的: list_db_backups, delete_db_backup, rename_db_backup

4. **自动备份** (`lib.rs` setup):
   - 初始化后立即调用 `periodic_backup_if_needed`
   - 启动后台 tokio task：每小时检查一次配置，按 interval 执行备份

### 前端 (Gemini 权威)
1. **类型定义** (`types/advanced.ts`):
   ```typescript
   interface BackupEntry { filename: string; sizeBytes: number; createdAt: string; }
   interface BackupSettings { intervalHours: number; retainCount: number; }
   ```

2. **服务层** (`services/advancedService.ts`): 7 个 invoke 封装函数

3. **UI 组件** (`components/settings/BackupPanel.tsx`):
   - 卡片头部: 标题 + 数据库图标
   - 两栏配置: 间隔选择器 + 保留数量选择器
   - 操作区: "立即备份" 按钮
   - 备份列表: 文件名/日期、大小、操作（重命名/恢复/删除）
   - 内联重命名 + ModalDialog 确认弹窗
   - 空状态 + Loading 状态

4. **i18n**: zh.json + en.json 的 `settings.backup.*` 命名空间

## 子任务列表

### Task 1: 后端备份核心逻辑
- **类型**: 后端 (Rust)
- **文件范围**:
  - `src-tauri/src/database/backup.rs` (新建)
  - `src-tauri/src/database/mod.rs` (修改: 添加 `mod backup;`)
- **依赖**: 无
- **实施步骤**:
  1. 在 `database/mod.rs` 添加 `mod backup;`
  2. 创建 `database/backup.rs`，定义 `BackupEntry` 和 `BackupSettings` 结构体
  3. 实现 `get_backups_dir()` → `~/.ccg-switch/backups/`
  4. 实现 `validate_backup_filename()` 路径安全校验
  5. 实现 `create_db_backup()` 使用 `rusqlite::backup::Backup`
  6. 实现 `list_db_backups()` 扫描备份目录
  7. 实现 `restore_db_backup()` 含恢复前安全备份
  8. 实现 `delete_db_backup()` 和 `rename_db_backup()`
  9. 实现 `get_backup_settings()` / `save_backup_settings()` 读写 `app_configs` 表
  10. 实现 `periodic_backup_if_needed()` 检查时间间隔
  11. 实现 `cleanup_db_backups()` 保留策略
- **验收标准**: 编译通过，核心函数签名正确，路径校验逻辑完整

### Task 2: 前端类型、服务层和 i18n
- **类型**: 前端 (TypeScript)
- **文件范围**:
  - `src/types/advanced.ts` (修改: 新增 BackupEntry, BackupSettings)
  - `src/services/advancedService.ts` (修改: 新增 7 个 invoke 封装)
  - `src/locales/zh.json` (修改: 新增 settings.backup.* keys)
  - `src/locales/en.json` (修改: 新增 settings.backup.* keys)
- **依赖**: 无
- **实施步骤**:
  1. 在 `types/advanced.ts` 添加 `BackupEntry` 和 `BackupSettings` 接口
  2. 在 `services/advancedService.ts` 添加 7 个函数封装 Tauri invoke
  3. 在 `zh.json` 添加备份相关中文翻译 (~15 个 key)
  4. 在 `en.json` 添加备份相关英文翻译 (~15 个 key)
- **验收标准**: TypeScript 编译通过，i18n key 中英文完整对应

### Task 3: 后端 Tauri 命令层
- **类型**: 后端 (Rust)
- **文件范围**:
  - `src-tauri/src/commands/backup_commands.rs` (新建)
  - `src-tauri/src/commands/mod.rs` (修改: 添加 `pub mod backup_commands;`)
- **依赖**: Task 1
- **实施步骤**:
  1. 创建 `commands/backup_commands.rs`
  2. 实现 7 个 `#[tauri::command]` 函数，调用 `Database` 的备份方法
  3. 在 `commands/mod.rs` 添加 `pub mod backup_commands;`
- **验收标准**: 编译通过，命令签名与前端 invoke 调用匹配

### Task 4: 前端备份面板 UI
- **类型**: 前端 (React/TypeScript)
- **文件范围**:
  - `src/components/settings/BackupPanel.tsx` (新建)
  - `src/pages/Settings.tsx` (修改: 导入 BackupPanel，插入 advanced tab)
- **依赖**: Task 2
- **实施步骤**:
  1. 创建 `BackupPanel.tsx`
  2. 实现备份设置区域（两栏下拉选择器）
  3. 实现"立即备份"按钮
  4. 实现备份列表（带 Loading/空状态）
  5. 实现内联重命名交互
  6. 实现 ModalDialog 确认弹窗（恢复/删除）
  7. 实现操作成功/失败提示
  8. 修改 Settings.tsx 导入并在 advanced tab 中 ImportExportPanel 和 WebDavBackupPanel 之间渲染
- **验收标准**: 前端编译通过，UI 与现有设置面板风格一致

### Task 5: 命令注册与自动备份集成
- **类型**: 后端 (Rust)
- **文件范围**:
  - `src-tauri/src/lib.rs` (修改: 注册命令 + setup 自动备份)
- **依赖**: Task 1, Task 3
- **实施步骤**:
  1. 在 `lib.rs` 顶部添加 `use commands::backup_commands;`
  2. 在 `generate_handler!` 中注册 7 个备份命令
  3. 在 `setup` 闭包中，数据库初始化后执行 `periodic_backup_if_needed`
  4. 启动后台 tokio task 定时检查自动备份（每小时检查一次设置，按 interval 执行）
- **验收标准**: `cargo build` 通过，应用启动时自动备份逻辑触发

## 文件冲突检查
✅ 无冲突 - 所有子任务的文件范围完全隔离

| 文件 | Task |
|------|------|
| `database/backup.rs` (新建) | Task 1 |
| `database/mod.rs` (修改) | Task 1 |
| `commands/backup_commands.rs` (新建) | Task 3 |
| `commands/mod.rs` (修改) | Task 3 |
| `lib.rs` (修改) | Task 5 |
| `types/advanced.ts` (修改) | Task 2 |
| `services/advancedService.ts` (修改) | Task 2 |
| `locales/zh.json` (修改) | Task 2 |
| `locales/en.json` (修改) | Task 2 |
| `components/settings/BackupPanel.tsx` (新建) | Task 4 |
| `pages/Settings.tsx` (修改) | Task 4 |

## 并行分组
- **Layer 1 (并行)**: Task 1 (后端核心), Task 2 (前端类型/服务/i18n)
- **Layer 2 (依赖 Layer 1)**: Task 3 (后端命令, 依赖 Task 1), Task 4 (前端 UI, 依赖 Task 2)
- **Layer 3 (依赖 Layer 2)**: Task 5 (集成注册, 依赖 Task 1 + Task 3)

## Builder 数量
- 最多 2 个 Builder 并行 (Layer 1)
- 总计 5 个子任务，预计 3 个 Layer
