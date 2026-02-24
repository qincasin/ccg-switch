use crate::models::config::Config;
use std::fs;
use std::io;
use std::path::PathBuf;
use serde_json;

fn get_config_path() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".claude-switch").join("config.json"))
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
