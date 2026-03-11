use crate::database::{lock_conn, Database};
use crate::services::global_proxy_service::GlobalProxyConfig;
use chrono::Utc;
use rusqlite::OptionalExtension;

impl Database {
    /// 获取全局代理配置
    pub fn get_global_proxy(&self) -> Result<Option<GlobalProxyConfig>, String> {
        let conn = lock_conn!(self.conn);
        let row: Option<(bool, Option<String>, Option<String>, Option<String>, Option<String>)> = conn
            .query_row(
                "SELECT enabled, http_proxy, https_proxy, socks5_proxy, no_proxy FROM global_proxies WHERE id = 'default'",
                [],
                |row| {
                    Ok((
                        row.get::<_, bool>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<String>>(4)?,
                    ))
                },
            )
            .optional()
            .map_err(|e| format!("Failed to get global_proxy: {e}"))?;

        match row {
            Some((enabled, http_proxy, https_proxy, socks5_proxy, no_proxy)) => {
                Ok(Some(GlobalProxyConfig {
                    enabled,
                    http_proxy,
                    https_proxy,
                    socks5_proxy,
                    no_proxy,
                }))
            }
            None => Ok(None),
        }
    }

    /// 保存全局代理配置
    pub fn upsert_global_proxy(&self, config: &GlobalProxyConfig) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        let updated_at = Utc::now().timestamp();
        conn.execute(
            "INSERT OR REPLACE INTO global_proxies (id, enabled, http_proxy, https_proxy, socks5_proxy, no_proxy, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params!["default", config.enabled, config.http_proxy, config.https_proxy, config.socks5_proxy, config.no_proxy, updated_at],
        )
        .map_err(|e| format!("Failed to upsert global_proxy: {e}"))?;
        Ok(())
    }
}
