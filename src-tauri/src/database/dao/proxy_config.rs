use crate::database::{lock_conn, Database};
use crate::proxy::types::{AppProxyConfig, RectifierConfig};
use rusqlite::OptionalExtension;

impl Database {
    /// 获取指定应用的代理配置，未找到则返回默认值
    pub async fn get_proxy_config_for_app(&self, app_type: &str) -> Result<AppProxyConfig, String> {
        let conn = lock_conn!(self.conn);
        let result = conn
            .query_row(
                "SELECT app_type, enabled, auto_failover_enabled, max_retries,
                 streaming_first_byte_timeout, streaming_idle_timeout, non_streaming_timeout,
                 circuit_failure_threshold, circuit_success_threshold, circuit_timeout_seconds,
                 circuit_error_rate_threshold, circuit_min_requests
                 FROM proxy_config WHERE app_type = ?1",
                rusqlite::params![app_type],
                |row| {
                    Ok(AppProxyConfig {
                        app_type: row.get(0)?,
                        enabled: row.get(1)?,
                        auto_failover_enabled: row.get(2)?,
                        max_retries: row.get(3)?,
                        streaming_first_byte_timeout: row.get(4)?,
                        streaming_idle_timeout: row.get(5)?,
                        non_streaming_timeout: row.get(6)?,
                        circuit_failure_threshold: row.get(7)?,
                        circuit_success_threshold: row.get(8)?,
                        circuit_timeout_seconds: row.get(9)?,
                        circuit_error_rate_threshold: row.get(10)?,
                        circuit_min_requests: row.get(11)?,
                    })
                },
            )
            .optional()
            .map_err(|e| format!("Failed to get proxy_config for {app_type}: {e}"))?;

        Ok(result.unwrap_or_else(|| AppProxyConfig::default_for(app_type)))
    }

    /// 更新指定应用的代理配置（INSERT OR REPLACE）
    pub async fn update_proxy_config_for_app(&self, config: AppProxyConfig) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "INSERT OR REPLACE INTO proxy_config (app_type, enabled, auto_failover_enabled,
             max_retries, streaming_first_byte_timeout, streaming_idle_timeout, non_streaming_timeout,
             circuit_failure_threshold, circuit_success_threshold, circuit_timeout_seconds,
             circuit_error_rate_threshold, circuit_min_requests)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![
                config.app_type,
                config.enabled,
                config.auto_failover_enabled,
                config.max_retries,
                config.streaming_first_byte_timeout,
                config.streaming_idle_timeout,
                config.non_streaming_timeout,
                config.circuit_failure_threshold,
                config.circuit_success_threshold,
                config.circuit_timeout_seconds,
                config.circuit_error_rate_threshold,
                config.circuit_min_requests,
            ],
        )
        .map_err(|e| format!("Failed to update proxy_config for {}: {e}", config.app_type))?;
        Ok(())
    }

    /// 获取整流器配置，从 app_configs 表读取 key="rectifier_config"
    pub fn get_rectifier_config(&self) -> Result<RectifierConfig, String> {
        let conn = lock_conn!(self.conn);
        let result: Option<String> = conn
            .query_row(
                "SELECT value FROM app_configs WHERE key = 'rectifier_config'",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| format!("Failed to get rectifier_config: {e}"))?;

        match result {
            Some(json_str) => serde_json::from_str(&json_str)
                .map_err(|e| format!("Failed to parse rectifier_config: {e}")),
            None => Ok(RectifierConfig::default()),
        }
    }
}
