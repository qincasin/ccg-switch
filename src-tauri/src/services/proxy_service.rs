use crate::models::proxy::ProxyConfig;
use crate::proxy::server;
use crate::proxy::types::ProxyState;
use std::fs;
use std::io;
use std::path::PathBuf;

fn get_proxy_config_path() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".ccg-switch").join("proxy_config.json"))
}

/// 读取代理配置，文件不存在时返回默认值
pub fn load_proxy_config() -> Result<ProxyConfig, io::Error> {
    let path = get_proxy_config_path()?;
    if !path.exists() {
        return Ok(ProxyConfig::default());
    }
    let content = fs::read_to_string(&path)?;
    serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

/// 保存代理配置到文件
pub fn save_proxy_config(config: &ProxyConfig) -> Result<(), io::Error> {
    let path = get_proxy_config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(&path, content)
}

/// 启动代理服务器
pub async fn start_proxy(config: ProxyConfig) -> Result<ProxyState, String> {
    server::start(&config.host, config.port).await
}

/// 停止代理服务器
pub async fn stop_proxy() -> Result<(), String> {
    server::stop().await
}

/// 获取代理服务器状态
pub fn get_proxy_status() -> Result<ProxyState, String> {
    Ok(server::get_state())
}
