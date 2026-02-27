use std::fs;
use std::io;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

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
    Ok(home.join(".claude-switch").join("global-proxy.json"))
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

/// 保存全局代理配置
pub fn set_global_proxy(config: &GlobalProxyConfig) -> Result<(), io::Error> {
    let path = get_proxy_config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(&path, content)
}
