#![allow(dead_code)]
use crate::models::token::TokensConfig;
use crate::models::provider::{Provider, ProvidersConfig};
use crate::services::storage::json_store;
use crate::database::Database;
use std::fs;
use std::io;
use std::path::PathBuf;
use std::sync::Arc;
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

/// global-proxy.json 路径
fn get_global_proxy_path() -> Result<PathBuf, io::Error> {
    Ok(get_data_dir()?.join("global-proxy.json"))
}

/// proxy_config.json 路径
fn get_proxy_config_path() -> Result<PathBuf, io::Error> {
    Ok(get_data_dir()?.join("proxy_config.json"))
}

/// skill-apps.json 路径
fn get_skill_apps_path() -> Result<PathBuf, io::Error> {
    Ok(get_data_dir()?.join("skill-apps.json"))
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

/// v2→v3 迁移前备份所有 JSON 文件
fn backup_for_v3() -> Result<PathBuf, io::Error> {
    let data_dir = get_data_dir()?;
    let backups_dir = data_dir.join("backups");
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let backup_dir = backups_dir.join(format!("v3_migration_{}", timestamp));
    fs::create_dir_all(&backup_dir)?;

    let files_to_backup = [
        "config.json",
        "providers.json",
        "global-proxy.json",
        "proxy_config.json",
        "skill-apps.json",
    ];

    for file_name in &files_to_backup {
        let src = data_dir.join(file_name);
        if src.exists() {
            fs::copy(&src, backup_dir.join(file_name))?;
        }
    }

    Ok(backup_dir)
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

/// v2 → v3 迁移：将 JSON 配置文件迁移到 SQLite 数据库
pub fn migrate_v2_to_v3(db: &Arc<Database>) -> Result<(), String> {

    let config_path = get_config_path();

    // 读取当前 schema version
    let schema_version: u32 = if let Ok(path) = &config_path {
        if path.exists() {
            let config: MigrationConfig = json_store::read_json(path).unwrap_or_default();
            config.schema_version
        } else {
            1
        }
    } else {
        1
    };

    // 如果已经是 v3 或更高，跳过迁移
    if schema_version >= 3 {
        return Ok(());
    }

    // 备份
    let _backup_dir = backup_for_v3().map_err(|e| format!("Backup failed: {e}"))?;

    // 开启事务
    let mut conn = db.conn.lock().map_err(|e| format!("Mutex lock failed: {e}"))?;
    let tx = conn.transaction().map_err(|e| format!("Transaction failed: {e}"))?;

    // 1. 迁移 config.json → app_configs
    if let Ok(path) = &config_path {
        if path.exists() {
            let config_content = fs::read_to_string(path)
                .map_err(|e| format!("Read config.json failed: {e}"))?;
            let config_value: serde_json::Value = serde_json::from_str(&config_content)
                .map_err(|e| format!("Parse config.json failed: {e}"))?;

            let config_json = serde_json::to_string(&config_value)
                .map_err(|e| format!("Serialize config.json failed: {e}"))?;

            // 存入 app_configs
            tx.execute(
                "INSERT OR REPLACE INTO app_configs (key, value, updated_at) VALUES (?1, ?2, ?3)",
                rusqlite::params!["app_config", config_json, Utc::now().timestamp()],
            ).map_err(|e| format!("Insert app_configs failed: {e}"))?;
        }
    }

    // 2. 迁移 providers.json → providers
    let providers_path = get_providers_path();
    if let Ok(path) = &providers_path {
        if path.exists() {
            let providers_config: ProvidersConfig = json_store::read_json(path)
                .map_err(|e| format!("Read providers.json failed: {e}"))?;

            for provider in providers_config.providers {
                // 使用 DAO 的 upsert 逻辑（需要适配 transaction）
                let custom_params_str = provider.custom_params.as_ref().and_then(|v| serde_json::to_string(v).ok());
                let settings_config_str = provider.settings_config.as_ref().and_then(|v| serde_json::to_string(v).ok());
                let meta_str = provider.meta.as_ref().and_then(|v| serde_json::to_string(v).ok());
                let tags_str = serde_json::to_string(&provider.tags).ok();
                let proxy_config_str = provider.proxy_config.as_ref().and_then(|v| serde_json::to_string(v).ok());

                tx.execute(
                    "INSERT OR REPLACE INTO providers (id, name, app_type, api_key, url, default_sonnet_model, default_opus_model, default_haiku_model, default_reasoning_model, custom_params, settings_config, meta, icon, in_failover_queue, description, tags, is_active, created_at, last_used, proxy_config) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)",
                    rusqlite::params![
                        provider.id,
                        provider.name,
                        provider.app_type.as_str(),
                        provider.api_key,
                        provider.url,
                        provider.default_sonnet_model,
                        provider.default_opus_model,
                        provider.default_haiku_model,
                        provider.default_reasoning_model,
                        custom_params_str,
                        settings_config_str,
                        meta_str,
                        provider.icon,
                        provider.in_failover_queue,
                        provider.description,
                        tags_str,
                        provider.is_active,
                        provider.created_at.timestamp(),
                        provider.last_used.map(|dt| dt.timestamp()).unwrap_or(0),
                        proxy_config_str,
                    ],
                ).map_err(|e| format!("Insert provider {} failed: {e}", provider.id))?;
            }
        }
    }

    // 3. 迁移 global-proxy.json → global_proxies
    let global_proxy_path = get_global_proxy_path();
    if let Ok(path) = &global_proxy_path {
        if path.exists() {
            use crate::services::global_proxy_service::GlobalProxyConfig;
            let config: GlobalProxyConfig = json_store::read_json(path)
                .map_err(|e| format!("Read global-proxy.json failed: {e}"))?;

            tx.execute(
                "INSERT OR REPLACE INTO global_proxies (id, enabled, http_proxy, https_proxy, socks5_proxy, no_proxy, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params!["default", config.enabled, config.http_proxy, config.https_proxy, config.socks5_proxy, config.no_proxy, Utc::now().timestamp()],
            ).map_err(|e| format!("Insert global_proxies failed: {e}"))?;
        }
    }

    // 4. 迁移 proxy_config.json → app_configs (key: proxy_server_config)
    let proxy_config_path = get_proxy_config_path();
    if let Ok(path) = &proxy_config_path {
        if path.exists() {
            use crate::models::proxy::ProxyConfig;
            let config: ProxyConfig = json_store::read_json(path)
                .map_err(|e| format!("Read proxy_config.json failed: {e}"))?;

            let config_json = serde_json::to_string(&config)
                .map_err(|e| format!("Serialize proxy_config.json failed: {e}"))?;

            tx.execute(
                "INSERT OR REPLACE INTO app_configs (key, value, updated_at) VALUES (?1, ?2, ?3)",
                rusqlite::params!["proxy_server_config", config_json, Utc::now().timestamp()],
            ).map_err(|e| format!("Insert proxy_config failed: {e}"))?;
        }
    }

    // 5. 迁移 skill-apps.json → app_configs (key: skill_apps_legacy)
    let skill_apps_path = get_skill_apps_path();
    if let Ok(path) = &skill_apps_path {
        if path.exists() {
            use crate::models::skill::SkillApps;
            let skill_apps: SkillApps = json_store::read_json(path)
                .map_err(|e| format!("Read skill-apps.json failed: {e}"))?;

            let config_json = serde_json::to_string(&skill_apps)
                .map_err(|e| format!("Serialize skill-apps.json failed: {e}"))?;

            tx.execute(
                "INSERT OR REPLACE INTO app_configs (key, value, updated_at) VALUES (?1, ?2, ?3)",
                rusqlite::params!["skill_apps_legacy", config_json, Utc::now().timestamp()],
            ).map_err(|e| format!("Insert skill_apps failed: {e}"))?;
        }
    }

    // 提交事务
    tx.commit().map_err(|e| format!("Commit transaction failed: {e}"))?;

    // 更新 schema version
    if let Ok(path) = &config_path {
        let mut config_value: serde_json::Value = if path.exists() {
            json_store::read_json(path).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        config_value["schemaVersion"] = serde_json::json!(3);

        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = json_store::write_json(path, &config_value);
    }

    Ok(())
}
