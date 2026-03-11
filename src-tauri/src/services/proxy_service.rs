use crate::database::Database;
use crate::models::proxy::ProxyConfig;
use crate::proxy::server;
use crate::proxy::types::ProxyState;
use std::fs;
use std::io;
use std::path::PathBuf;
use std::sync::Arc;

fn get_proxy_config_path() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".ccg-switch").join("proxy_config.json"))
}

/// 从数据库加载代理配置（v3+，失败时回退到 JSON）
pub fn load_proxy_config_from_db(db: &Arc<Database>) -> Result<ProxyConfig, String> {
    match db.get_app_config("proxy_server_config")? {
        Some(json) => {
            let config: ProxyConfig = serde_json::from_str(&json)
                .map_err(|e| format!("Parse config failed: {e}"))?;
            Ok(config)
        }
        None => {
            // 数据库为空时，从 JSON 文件回退加载
            if let Ok(config) = load_proxy_config() {
                // 将 JSON 数据迁移到数据库
                let config_json = serde_json::to_string(&config)
                    .map_err(|e| format!("Serialize config failed: {e}"))?;
                let _ = db.set_app_config("proxy_server_config", &config_json);
                return Ok(config);
            }
            Ok(ProxyConfig::default())
        }
    }
}

/// 保存代理配置到数据库（v3+）
pub fn save_proxy_config_to_db(db: &Arc<Database>, config: &ProxyConfig) -> Result<(), String> {
    let config_json = serde_json::to_string(config)
        .map_err(|e| format!("Serialize config failed: {e}"))?;
    db.set_app_config("proxy_server_config", &config_json)
}

/// 读取代理配置，文件不存在时返回默认值（兼容旧版）
pub fn load_proxy_config() -> Result<ProxyConfig, io::Error> {
    let path = get_proxy_config_path()?;
    if !path.exists() {
        return Ok(ProxyConfig::default());
    }
    let content = fs::read_to_string(&path)?;
    serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

/// 保存代理配置到文件（保留兼容）
#[allow(dead_code)]
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
