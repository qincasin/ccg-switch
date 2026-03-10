#![allow(dead_code)]
use crate::models::token::TokensConfig;
use crate::models::provider::{Provider, ProvidersConfig};
use crate::services::storage::json_store;
use std::fs;
use std::io;
use std::path::PathBuf;
use chrono::Utc;
use serde::{Deserialize, Serialize};

/// 迁移配置：记录 schemaVersion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationConfig {
    #[serde(rename = "schemaVersion", default)]
    pub schema_version: u32,
}

impl Default for MigrationConfig {
    fn default() -> Self {
        Self { schema_version: 1 }
    }
}

/// 数据目录 ~/.ccg-switch/
fn get_data_dir() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".ccg-switch"))
}

/// 旧数据目录 ~/.claude-switch/ （用于迁移）
fn get_legacy_data_dir() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".claude-switch"))
}

/// 将 ~/.claude-switch/ 迁移到 ~/.ccg-switch/（增量合并，不覆盖已有文件）
fn migrate_directory() -> Result<bool, io::Error> {
    let old_dir = get_legacy_data_dir()?;
    let new_dir = get_data_dir()?;

    // 旧目录不存在，无需迁移
    if !old_dir.exists() {
        return Ok(false);
    }

    // 增量合并：将旧目录中不存在于新目录的文件复制过去
    merge_dir_recursive(&old_dir, &new_dir)?;
    Ok(true)
}

/// 递归合并目录：仅复制目标中不存在的文件
fn merge_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), io::Error> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            merge_dir_recursive(&src_path, &dst_path)?;
        } else if !dst_path.exists() {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

/// providers.json 路径
fn get_providers_path() -> Result<PathBuf, io::Error> {
    Ok(get_data_dir()?.join("providers.json"))
}

/// 旧版 tokens.json 路径
fn get_legacy_tokens_path() -> Result<PathBuf, io::Error> {
    Ok(get_data_dir()?.join("tokens.json"))
}

/// config.json 路径
fn get_config_path() -> Result<PathBuf, io::Error> {
    Ok(get_data_dir()?.join("config.json"))
}

/// 迁移前备份旧文件到 ~/.ccg-switch/backups/
fn backup_legacy_files() -> Result<(), io::Error> {
    let tokens_path = get_legacy_tokens_path()?;
    if !tokens_path.exists() {
        return Ok(());
    }
    let backups_dir = get_data_dir()?.join("backups");
    fs::create_dir_all(&backups_dir)?;

    let timestamp = Utc::now().format("%Y%m%d%H%M%S");
    let backup_name = format!("tokens.json.bak.{}", timestamp);
    fs::copy(&tokens_path, backups_dir.join(backup_name))?;

    Ok(())
}

/// 核心迁移：将 tokens.json 中的 ApiToken 转换为 Provider 写入 providers.json
fn migrate_v1_tokens_to_providers() -> Result<(), io::Error> {
    let tokens_path = get_legacy_tokens_path()?;
    if !tokens_path.exists() {
        return Ok(());
    }

    // 读取旧数据
    let tokens_config: TokensConfig = json_store::read_json(&tokens_path)?;
    let new_providers: Vec<Provider> = tokens_config
        .tokens
        .into_iter()
        .map(Provider::from)
        .collect();

    // 读取已有 providers（如果存在），按 id 去重合并
    let providers_path = get_providers_path()?;
    let mut existing: Vec<Provider> = if providers_path.exists() {
        let config: ProvidersConfig = json_store::read_json(&providers_path)?;
        config.providers
    } else {
        Vec::new()
    };

    // 收集已有 id
    let existing_ids: std::collections::HashSet<String> =
        existing.iter().map(|p| p.id.clone()).collect();

    // 仅追加不重复的
    for provider in new_providers {
        if !existing_ids.contains(&provider.id) {
            existing.push(provider);
        }
    }

    // 原子写入
    let config = ProvidersConfig {
        providers: existing,
    };
    if let Some(parent) = providers_path.parent() {
        fs::create_dir_all(parent)?;
    }
    json_store::write_json(&providers_path, &config)?;

    Ok(())
}

/// 启动时调用：检查 schemaVersion 并执行必要的迁移（幂等）
pub fn check_and_run_migration() -> Result<(), io::Error> {
    // 先执行目录迁移：~/.claude-switch/ → ~/.ccg-switch/
    migrate_directory()?;

    let config_path = get_config_path()?;

    // 读取当前 config，不存在则用默认值（schemaVersion = 1）
    let migration_config: MigrationConfig = if config_path.exists() {
        json_store::read_json(&config_path).unwrap_or_default()
    } else {
        MigrationConfig::default()
    };

    let tokens_path = get_legacy_tokens_path()?;

    // v1 → v2：tokens.json → providers.json
    if migration_config.schema_version < 2 && tokens_path.exists() {
        backup_legacy_files()?;
        migrate_v1_tokens_to_providers()?;

        // 迁移成功后重命名 tokens.json，防止重装后重复迁移导致已删除配置复活
        let migrated_path = tokens_path.with_extension("json.migrated");
        let _ = fs::rename(&tokens_path, &migrated_path);

        // config.json 可能包含其他字段（theme/language），需要合并写入
        let mut config_value: serde_json::Value = if config_path.exists() {
            json_store::read_json(&config_path).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        config_value["schemaVersion"] = serde_json::json!(2);

        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        json_store::write_json(&config_path, &config_value)?;
    }

    Ok(())
}
