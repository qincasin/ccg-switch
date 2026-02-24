use crate::models::mcp::{McpConfig, McpServer, ServerConfig, TransportType, McpSource};
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
