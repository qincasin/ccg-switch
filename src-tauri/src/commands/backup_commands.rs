use crate::database::backup::{BackupEntry, BackupSettings};
use crate::store::AppState;
use tauri::State;

/// 创建数据库备份
#[tauri::command]
pub fn create_db_backup(state: State<'_, AppState>) -> Result<BackupEntry, String> {
    state.db.create_db_backup()
}

/// 列出所有备份
#[tauri::command]
pub fn list_db_backups() -> Result<Vec<BackupEntry>, String> {
    crate::database::Database::list_db_backups()
}

/// 从备份恢复数据库
#[tauri::command]
pub fn restore_db_backup(state: State<'_, AppState>, filename: String) -> Result<String, String> {
    state.db.restore_db_backup(&filename)
}

/// 删除备份文件
#[tauri::command]
pub fn delete_db_backup(filename: String) -> Result<(), String> {
    crate::database::Database::delete_db_backup(&filename)
}

/// 重命名备份文件
#[tauri::command]
pub fn rename_db_backup(old_name: String, new_name: String) -> Result<(), String> {
    crate::database::Database::rename_db_backup(&old_name, &new_name)
}

/// 获取备份设置
#[tauri::command]
pub fn get_backup_settings(state: State<'_, AppState>) -> Result<BackupSettings, String> {
    state.db.get_backup_settings()
}

/// 保存备份设置
#[tauri::command]
pub fn save_backup_settings(state: State<'_, AppState>, settings: BackupSettings) -> Result<(), String> {
    state.db.save_backup_settings(&settings)
}
