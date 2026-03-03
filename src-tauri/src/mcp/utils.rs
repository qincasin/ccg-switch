use std::io::Write;
use std::path::Path;

use crate::error::AppError;

/// 原子写入文件（tmp + rename 模式）
/// 确保写入操作的原子性，避免数据损坏
pub fn atomic_write(path: &Path, content: &str) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::IoContext {
                context: format!("Failed to create directory"),
                source: e,
            })?;
    }
    let tmp = path.with_extension("tmp");
    let mut f = std::fs::File::create(&tmp)
        .map_err(|e| AppError::Io {
            path: tmp.display().to_string(),
            source: e,
        })?;
    f.write_all(content.as_bytes())
        .map_err(|e| AppError::Io {
            path: tmp.display().to_string(),
            source: e,
        })?;
    f.flush().map_err(|e| AppError::Io {
        path: tmp.display().to_string(),
        source: e,
    })?;
    drop(f);
    std::fs::rename(&tmp, path)
        .map_err(|e| AppError::Io {
            path: path.display().to_string(),
            source: e,
        })
}

/// 获取用户主目录
pub fn home_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir()
}

/// 获取 Claude 配置文件路径 (~/.claude.json)
pub fn get_claude_json_path() -> Option<std::path::PathBuf> {
    home_dir().map(|h| h.join(".claude.json"))
}

/// 获取 Claude settings.json 路径 (~/.claude/settings.json)
pub fn get_claude_settings_path() -> Option<std::path::PathBuf> {
    home_dir().map(|h| h.join(".claude").join("settings.json"))
}

/// 获取 Codex 配置目录 (~/.codex)
pub fn get_codex_config_dir() -> std::path::PathBuf {
    home_dir()
        .unwrap_or_default()
        .join(".codex")
}

/// 获取 Codex 配置文件路径 (~/.codex/config.toml)
pub fn get_codex_config_path() -> Option<std::path::PathBuf> {
    home_dir().map(|h| h.join(".codex").join("config.toml"))
}

/// 检查 Codex 是否已安装（~/.codex 目录存在）
pub fn should_sync_codex_mcp() -> bool {
    get_codex_config_dir().exists()
}

/// 获取 Gemini settings.json 路径 (~/.gemini/settings.json)
pub fn get_gemini_settings_path() -> Option<std::path::PathBuf> {
    home_dir().map(|h| h.join(".gemini").join("settings.json"))
}

/// 检查 Gemini 是否已安装（~/.gemini 目录存在）
pub fn should_sync_gemini_mcp() -> bool {
    home_dir()
        .map(|h| h.join(".gemini").exists())
        .unwrap_or(false)
}