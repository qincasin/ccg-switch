use crate::database::{lock_conn, Database};
use chrono::Utc;
use rusqlite::OptionalExtension;

impl Database {
    /// 获取应用配置值
    pub fn get_app_config(&self, key: &str) -> Result<Option<String>, String> {
        let conn = lock_conn!(self.conn);
        let result: Option<String> = conn
            .query_row(
                "SELECT value FROM app_configs WHERE key = ?1",
                rusqlite::params![key],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| format!("Failed to get app_config: {e}"))?;
        Ok(result)
    }

    /// 设置应用配置值
    pub fn set_app_config(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        let updated_at = Utc::now().timestamp();
        conn.execute(
            "INSERT OR REPLACE INTO app_configs (key, value, updated_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![key, value, updated_at],
        )
        .map_err(|e| format!("Failed to set app_config: {e}"))?;
        Ok(())
    }

    /// 删除应用配置（保留兼容）
    #[allow(dead_code)]
    pub fn delete_app_config(&self, key: &str) -> Result<bool, String> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute("DELETE FROM app_configs WHERE key = ?1", rusqlite::params![key])
            .map_err(|e| format!("Failed to delete app_config: {e}"))?;
        Ok(affected > 0)
    }
}
