use crate::models::config::Config;
use crate::database::Database;
use std::fs;
use std::io;
use std::path::PathBuf;
use std::sync::Arc;
use serde_json;

fn get_config_path() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".ccg-switch").join("config.json"))
}

/// 从数据库加载配置（v3+，失败时回退到 JSON）
pub fn load_config_from_db(db: &Arc<Database>) -> Result<Config, String> {
    let config_json = db.get_app_config("app_config")?;
    match config_json {
        Some(json) => {
            let config: Config = serde_json::from_str(&json)
                .map_err(|e| format!("Parse config failed: {e}"))?;
            Ok(config)
        }
        None => {
            // 数据库为空时，从 JSON 文件回退加载
            if let Ok(config) = load_config() {
                // 将 JSON 数据迁移到数据库
                let config_json = serde_json::to_string(&config)
                    .map_err(|e| format!("Serialize config failed: {e}"))?;
                let _ = db.set_app_config("app_config", &config_json);
                return Ok(config);
            }
            Ok(Config::default())
        }
    }
}

/// 保存配置到数据库（v3+）
pub fn save_config_to_db(db: &Arc<Database>, config: &Config) -> Result<(), String> {
    let config_json = serde_json::to_string(config)
        .map_err(|e| format!("Serialize config failed: {e}"))?;
    db.set_app_config("app_config", &config_json)
}

pub fn load_config() -> Result<Config, io::Error> {
    let config_path = get_config_path()?;

    if !config_path.exists() {
        // 返回默认配置
        return Ok(Config::default());
    }

    let content = fs::read_to_string(&config_path)?;
    let config: Config = serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    Ok(config)
}

/// 保存配置到文件（保留兼容）
#[allow(dead_code)]
pub fn save_config(config: &Config) -> Result<(), io::Error> {
    let config_path = get_config_path()?;

    // 确保目录存在
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    fs::write(&config_path, content)?;

    Ok(())
}
