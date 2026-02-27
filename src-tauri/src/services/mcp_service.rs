use crate::models::mcp::{McpApps, McpConfig, McpServer, ServerConfig, TransportType, McpSource};
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::PathBuf;
use serde_json;

fn get_global_mcp_path() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".claude.json"))
}

fn get_project_mcp_path(project_dir: Option<&str>) -> Option<PathBuf> {
    project_dir.map(|dir| PathBuf::from(dir).join(".mcp.json"))
}

fn get_disabled_mcp_path() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".ci").join("disabled_mcp.json"))
}

fn load_mcp_config(path: &PathBuf) -> Result<McpConfig, io::Error> {
    if !path.exists() {
        return Ok(McpConfig {
            mcpServers: HashMap::new(),
        });
    }

    let content = fs::read_to_string(path)?;
    let config: McpConfig = serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    Ok(config)
}

pub fn list_mcp_servers(project_dir: Option<&str>) -> Result<Vec<McpServer>, io::Error> {
    let mut servers = Vec::new();
    let mut id_counter = 0;

    // 加载全局配置
    let global_path = get_global_mcp_path()?;
    let global_config = load_mcp_config(&global_path)?;

    for (name, server_config) in global_config.mcpServers {
        let transport = if server_config.url.is_some() {
            TransportType::Http
        } else {
            TransportType::Stdio
        };

        servers.push(McpServer {
            id: format!("global_{}", id_counter),
            name,
            command: server_config.command,
            args: server_config.args,
            url: server_config.url,
            env: server_config.env,
            enabled: true,
            transport,
            source: McpSource::Global,
            apps: server_config.apps,
        });
        id_counter += 1;
    }

    // 加载项目级配置
    if let Some(project_path) = get_project_mcp_path(project_dir) {
        let project_config = load_mcp_config(&project_path)?;

        for (name, server_config) in project_config.mcpServers {
            let transport = if server_config.url.is_some() {
                TransportType::Http
            } else {
                TransportType::Stdio
            };

            servers.push(McpServer {
                id: format!("project_{}", id_counter),
                name,
                command: server_config.command,
                args: server_config.args,
                url: server_config.url,
                env: server_config.env,
                enabled: true,
                transport,
                source: McpSource::Project,
                apps: server_config.apps,
            });
            id_counter += 1;
        }
    }

    Ok(servers)
}

pub fn add_mcp_server(server: McpServer, is_global: bool) -> Result<(), io::Error> {
    let config_path = if is_global {
        get_global_mcp_path()?
    } else {
        // 这里需要传入项目路径，暂时使用全局路径
        get_global_mcp_path()?
    };

    let mut config = load_mcp_config(&config_path)?;

    let server_config = ServerConfig {
        command: server.command,
        args: server.args,
        url: server.url,
        env: server.env,
        apps: server.apps,
    };

    config.mcpServers.insert(server.name, server_config);

    // 确保目录存在
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    fs::write(&config_path, content)?;

    Ok(())
}

pub fn delete_mcp_server(server_name: &str, is_global: bool) -> Result<(), io::Error> {
    let config_path = if is_global {
        get_global_mcp_path()?
    } else {
        get_global_mcp_path()?
    };

    let mut config = load_mcp_config(&config_path)?;

    config.mcpServers.remove(server_name);

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    fs::write(&config_path, content)?;

    Ok(())
}

/// 获取指定应用已启用的 MCP 服务器列表
/// - apps 字段为空（旧数据）→ 默认全部启用
/// - apps[app] = true → 启用
/// - apps[app] = false → 禁用
pub fn list_mcp_servers_for_app(project_dir: Option<&str>, app: &str) -> Result<Vec<McpServer>, io::Error> {
    let all_servers = list_mcp_servers(project_dir)?;
    let filtered = all_servers
        .into_iter()
        .filter(|s| {
            if s.apps.is_empty() {
                // 旧数据：apps 为空，视为全部启用
                true
            } else {
                // 有 apps 记录时，查找该应用的开关值，默认 true
                *s.apps.get(app).unwrap_or(&true)
            }
        })
        .collect();
    Ok(filtered)
}

/// 更新 MCP 服务器的 per-app 开关
pub fn update_mcp_server_apps(server_name: &str, is_global: bool, apps: McpApps) -> Result<(), io::Error> {
    let config_path = if is_global {
        get_global_mcp_path()?
    } else {
        get_global_mcp_path()?
    };

    let mut config = load_mcp_config(&config_path)?;

    if let Some(server_config) = config.mcpServers.get_mut(server_name) {
        server_config.apps = apps;
    } else {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("MCP server '{}' not found", server_name),
        ));
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    fs::write(&config_path, content)?;

    Ok(())
}
