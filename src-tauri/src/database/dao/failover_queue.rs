use crate::database::{lock_conn, Database};
use serde::{Deserialize, Serialize};

/// 故障转移队列条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailoverQueueItem {
    pub provider_id: String,
    pub sort_order: i32,
}

impl Database {
    /// 获取指定应用的故障转移队列，按 sort_order 升序
    pub fn get_failover_queue(&self, app_type: &str) -> Result<Vec<FailoverQueueItem>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                "SELECT provider_id, sort_order FROM failover_queue
                 WHERE app_type = ?1 ORDER BY sort_order ASC",
            )
            .map_err(|e| format!("Failed to prepare failover_queue query: {e}"))?;

        let rows = stmt
            .query_map(rusqlite::params![app_type], |row| {
                Ok(FailoverQueueItem {
                    provider_id: row.get(0)?,
                    sort_order: row.get(1)?,
                })
            })
            .map_err(|e| format!("Failed to query failover_queue: {e}"))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| format!("Failed to read failover_queue row: {e}"))?);
        }
        Ok(items)
    }

    /// 添加 Provider 到故障转移队列（追加到末尾）
    pub fn add_to_failover_queue(&self, app_type: &str, provider_id: &str) -> Result<(), String> {
        let conn = lock_conn!(self.conn);

        // 获取当前最大 sort_order
        let max_order: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(sort_order), -1) FROM failover_queue WHERE app_type = ?1",
                rusqlite::params![app_type],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to get max sort_order: {e}"))?;

        conn.execute(
            "INSERT OR IGNORE INTO failover_queue (app_type, provider_id, sort_order)
             VALUES (?1, ?2, ?3)",
            rusqlite::params![app_type, provider_id, max_order + 1],
        )
        .map_err(|e| format!("Failed to add to failover_queue: {e}"))?;
        Ok(())
    }

    /// 从故障转移队列中移除 Provider
    pub fn remove_from_failover_queue(
        &self,
        app_type: &str,
        provider_id: &str,
    ) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "DELETE FROM failover_queue WHERE app_type = ?1 AND provider_id = ?2",
            rusqlite::params![app_type, provider_id],
        )
        .map_err(|e| format!("Failed to remove from failover_queue: {e}"))?;
        Ok(())
    }
}
