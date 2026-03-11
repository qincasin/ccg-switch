use std::fs;
use std::io;
use std::path::PathBuf;
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use crate::database::Database;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlobalProxyConfig {
    #[serde(rename = "enabled")]
    pub enabled: bool,
    #[serde(rename = "httpProxy")]
    pub http_proxy: Option<String>,
    #[serde(rename = "httpsProxy")]
    pub https_proxy: Option<String>,
    #[serde(rename = "socks5Proxy")]
    pub socks5_proxy: Option<String>,
    #[serde(rename = "noProxy")]
    pub no_proxy: Option<String>,
}

fn get_proxy_config_path() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".ccg-switch").join("global-proxy.json"))
}

/// 从数据库加载全局代理配置（v3+，失败时回退到 JSON）
pub fn get_global_proxy_from_db(db: &Arc<Database>) -> Result<GlobalProxyConfig, String> {
    match db.get_global_proxy()? {
        Some(config) => Ok(config),
        None => {
            // 数据库为空时，从 JSON 文件回退加载
            if let Ok(config) = get_global_proxy() {
                // 将 JSON 数据迁移到数据库
                let _ = db.upsert_global_proxy(&config);
                return Ok(config);
            }
            Ok(GlobalProxyConfig::default())
        }
    }
}

/// 保存全局代理配置到数据库（v3+）
pub fn set_global_proxy_to_db(db: &Arc<Database>, config: &GlobalProxyConfig) -> Result<(), String> {
    db.upsert_global_proxy(config)
}

/// 获取全局代理配置
pub fn get_global_proxy() -> Result<GlobalProxyConfig, io::Error> {
    let path = get_proxy_config_path()?;
    if !path.exists() {
        return Ok(GlobalProxyConfig::default());
    }
    let content = fs::read_to_string(&path)?;
    serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

/// 保存全局代理配置（保留兼容）
#[allow(dead_code)]
pub fn set_global_proxy(config: &GlobalProxyConfig) -> Result<(), io::Error> {
    let path = get_proxy_config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(&path, content)
}
