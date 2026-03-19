use crate::database::{lock_conn, Database};
use chrono::Utc;
use rusqlite::OptionalExtension;

impl Database {
    /// 更新 Provider 健康状态（带阈值判定）
    ///
    /// - success=true: 重置连续失败数，标记为健康
    /// - success=false: 递增连续失败数，当达到阈值时标记为不健康
    pub async fn update_provider_health_with_threshold(
        &self,
        provider_id: &str,
        app_type: &str,
        success: bool,
        error_msg: Option<String>,
        failure_threshold: u32,
    ) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        let now = Utc::now().to_rfc3339();

        // 先查询当前状态
        let current: Option<(bool, u32)> = conn
            .query_row(
                "SELECT is_healthy, consecutive_failures FROM provider_health
                 WHERE provider_id = ?1 AND app_type = ?2",
                rusqlite::params![provider_id, app_type],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|e| format!("Failed to query provider_health: {e}"))?;

        let (is_healthy, consecutive_failures) = if success {
            // 成功：重置
            (true, 0u32)
        } else {
            // 失败：递增
            let prev_failures = current.map(|(_, f)| f).unwrap_or(0);
            let new_failures = prev_failures + 1;
            let healthy = new_failures < failure_threshold;
            (healthy, new_failures)
        };

        let last_success_at = if success { Some(now.clone()) } else { None };
        let last_failure_at = if !success { Some(now.clone()) } else { None };

        // 使用条件更新，只更新变化的时间戳字段
        if current.is_some() {
            if success {
                conn.execute(
                    "UPDATE provider_health SET is_healthy = ?1, consecutive_failures = ?2,
                     last_success_at = ?3, last_error = NULL, updated_at = ?4
                     WHERE provider_id = ?5 AND app_type = ?6",
                    rusqlite::params![
                        is_healthy,
                        consecutive_failures,
                        last_success_at,
                        &now,
                        provider_id,
                        app_type,
                    ],
                )
                .map_err(|e| format!("Failed to update provider_health: {e}"))?;
            } else {
                conn.execute(
                    "UPDATE provider_health SET is_healthy = ?1, consecutive_failures = ?2,
                     last_failure_at = ?3, last_error = ?4, updated_at = ?5
                     WHERE provider_id = ?6 AND app_type = ?7",
                    rusqlite::params![
                        is_healthy,
                        consecutive_failures,
                        last_failure_at,
                        error_msg,
                        &now,
                        provider_id,
                        app_type,
                    ],
                )
                .map_err(|e| format!("Failed to update provider_health: {e}"))?;
            }
        } else {
            // 不存在则插入
            conn.execute(
                "INSERT INTO provider_health (provider_id, app_type, is_healthy,
                 consecutive_failures, last_success_at, last_failure_at, last_error, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    provider_id,
                    app_type,
                    is_healthy,
                    consecutive_failures,
                    last_success_at,
                    last_failure_at,
                    error_msg,
                    &now,
                ],
            )
            .map_err(|e| format!("Failed to insert provider_health: {e}"))?;
        }

        Ok(())
    }

    /// 同步读取代理标志位 (enabled, auto_failover_enabled)
    ///
    /// 从 proxy_config 表读取，未找到返回 (false, false)
    pub fn get_proxy_flags_sync(&self, app_type: &str) -> (bool, bool) {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(_) => return (false, false),
        };

        conn.query_row(
            "SELECT enabled, auto_failover_enabled FROM proxy_config WHERE app_type = ?1",
            rusqlite::params![app_type],
            |row| {
                let enabled: bool = row.get(0)?;
                let auto_failover: bool = row.get(1)?;
                Ok((enabled, auto_failover))
            },
        )
        .unwrap_or((false, false))
    }

    /// 同步更新代理标志位 (enabled, auto_failover_enabled)
    pub fn set_proxy_flags_sync(
        &self,
        app_type: &str,
        enabled: bool,
        auto_failover: bool,
    ) -> Result<(), String> {
        let conn = lock_conn!(self.conn);

        // 先尝试更新
        let affected = conn
            .execute(
                "UPDATE proxy_config SET enabled = ?1, auto_failover_enabled = ?2
                 WHERE app_type = ?3",
                rusqlite::params![enabled, auto_failover, app_type],
            )
            .map_err(|e| format!("Failed to update proxy flags: {e}"))?;

        // 如果没有匹配行则插入
        if affected == 0 {
            conn.execute(
                "INSERT INTO proxy_config (app_type, enabled, auto_failover_enabled)
                 VALUES (?1, ?2, ?3)",
                rusqlite::params![app_type, enabled, auto_failover],
            )
            .map_err(|e| format!("Failed to insert proxy flags: {e}"))?;
        }

        Ok(())
    }
}
