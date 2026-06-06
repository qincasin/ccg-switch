//! Antigravity 操作日志 SQLite 数据访问层。
//!
//! 记录 token 刷新、账号切换、配额刷新、预热等操作历史。

#![allow(dead_code)]
use crate::database::{lock_conn, Database};
use crate::models::antigravity::AgOperationLog;
use rusqlite::OptionalExtension;

impl Database {
    pub fn log_ag_operation(
        &self,
        account_id: &str,
        account_email: &str,
        operation: &str,
        detail: Option<&str>,
    ) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT INTO ag_operation_log (account_id, account_email, operation, detail, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![account_id, account_email, operation, detail, now],
        )
        .map_err(|e| format!("Failed to insert operation log: {e}"))?;
        Ok(())
    }

    pub fn list_ag_operation_logs(
        &self,
        account_id: &str,
        limit: i64,
    ) -> Result<Vec<AgOperationLog>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                "SELECT id, account_id, account_email, operation, detail, created_at FROM ag_operation_log WHERE account_id = ?1 ORDER BY created_at DESC LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;

        let logs = stmt
            .query_map(rusqlite::params![account_id, limit], |row| {
                Ok(row_to_operation_log(row))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|l| l.ok())
            .collect();

        Ok(logs)
    }

    pub fn list_all_ag_operation_logs(
        &self,
        limit: i64,
    ) -> Result<Vec<AgOperationLog>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                "SELECT id, account_id, account_email, operation, detail, created_at FROM ag_operation_log ORDER BY created_at DESC LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;

        let logs = stmt
            .query_map(rusqlite::params![limit], |row| {
                Ok(row_to_operation_log(row))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|l| l.ok())
            .collect();

        Ok(logs)
    }

    pub fn get_last_token_refresh_log(
        &self,
        account_id: &str,
    ) -> Result<Option<AgOperationLog>, String> {
        let conn = lock_conn!(self.conn);
        let result = conn
            .query_row(
                "SELECT id, account_id, account_email, operation, detail, created_at FROM ag_operation_log WHERE account_id = ?1 AND operation = 'token_refresh' ORDER BY created_at DESC LIMIT 1",
                rusqlite::params![account_id],
                |row| Ok(row_to_operation_log(row)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        Ok(result)
    }

    pub fn get_token_refresh_count(&self, account_id: &str) -> Result<i64, String> {
        let conn = lock_conn!(self.conn);
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM ag_operation_log WHERE account_id = ?1 AND operation = 'token_refresh'",
                rusqlite::params![account_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        Ok(count)
    }
}

fn row_to_operation_log(row: &rusqlite::Row) -> AgOperationLog {
    AgOperationLog {
        id: row.get("id").unwrap_or_default(),
        account_id: row.get("account_id").unwrap_or_default(),
        account_email: row.get("account_email").unwrap_or_default(),
        operation: row.get("operation").unwrap_or_default(),
        detail: row.get("detail").unwrap_or(None),
        created_at: row.get("created_at").unwrap_or_default(),
    }
}
