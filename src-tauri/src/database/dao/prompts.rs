use crate::database::{lock_conn, Database};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptRow {
    pub id: String,
    pub app_type: String,
    pub name: String,
    pub content: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Database {
    /// 获取指定应用的所有 prompts
    pub fn get_prompts_by_app(&self, app_type: &str) -> Result<Vec<PromptRow>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT id, app_type, name, content, description, enabled, created_at, updated_at FROM prompts WHERE app_type = ?1 ORDER BY name ASC")
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let rows = stmt
            .query_map(rusqlite::params![app_type], |row| {
                Ok(PromptRow {
                    id: row.get(0)?,
                    app_type: row.get(1)?,
                    name: row.get(2)?,
                    content: row.get(3)?,
                    description: row.get(4)?,
                    enabled: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })
            .map_err(|e| format!("Failed to query prompts: {e}"))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| format!("Failed to read row: {e}"))?);
        }
        Ok(result)
    }

    /// 保存 prompt (INSERT OR REPLACE)
    pub fn save_prompt(&self, prompt: &PromptRow) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "INSERT OR REPLACE INTO prompts (id, app_type, name, content, description, enabled, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                prompt.id,
                prompt.app_type,
                prompt.name,
                prompt.content,
                prompt.description,
                prompt.enabled,
                prompt.created_at,
                prompt.updated_at,
            ],
        )
        .map_err(|e| format!("Failed to save prompt: {e}"))?;
        Ok(())
    }

    /// 删除 prompt
    pub fn delete_prompt_row(&self, id: &str, app_type: &str) -> Result<bool, String> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "DELETE FROM prompts WHERE id = ?1 AND app_type = ?2",
                rusqlite::params![id, app_type],
            )
            .map_err(|e| format!("Failed to delete prompt: {e}"))?;
        Ok(affected > 0)
    }

    /// 禁用指定应用下所有 prompts
    pub fn disable_all_prompts(&self, app_type: &str) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "UPDATE prompts SET enabled = 0 WHERE app_type = ?1",
            rusqlite::params![app_type],
        )
        .map_err(|e| format!("Failed to disable all prompts: {e}"))?;
        Ok(())
    }

    /// 设置单个 prompt 的启用状态
    pub fn set_prompt_enabled(&self, id: &str, app_type: &str, enabled: bool) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "UPDATE prompts SET enabled = ?1, updated_at = ?2 WHERE id = ?3 AND app_type = ?4",
            rusqlite::params![enabled, chrono::Utc::now().timestamp(), id, app_type],
        )
        .map_err(|e| format!("Failed to set prompt enabled: {e}"))?;
        Ok(())
    }
}
