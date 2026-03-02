use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;

fn get_claude_json_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude.json"))
}

fn get_claude_settings_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("settings.json"))
}

/// 从单个 JSON 文件中读取 mcpServers
fn read_mcp_from_file(path: &std::path::Path) -> HashMap<String, Value> {
    if !path.exists() {
        return HashMap::new();
    }
    let text = match std::fs::read_to_string(path) {
        Ok(t) => t,
        Err(_) => return HashMap::new(),
    };
    let val: Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => return HashMap::new(),
    };
    val.get("mcpServers")
        .and_then(|v| v.as_object())
        .map(|m| m.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default()
}

/// 从所有 Claude 配置源读取 MCP 服务器
/// 支持两个位置：
/// 1. ~/.claude/settings.json → mcpServers（低优先级）
/// 2. ~/.claude.json → mcpServers（高优先级，覆盖同名）
fn read_mcp_servers() -> HashMap<String, Value> {
    let mut result = HashMap::new();

    // 1) 先读 ~/.claude/settings.json（低优先级）
    if let Some(settings_path) = get_claude_settings_path() {
        for (k, v) in read_mcp_from_file(&settings_path) {
            result.insert(k, v);
        }
    }

    // 2) 再读 ~/.claude.json（高优先级，覆盖同名）
    if let Some(json_path) = get_claude_json_path() {
        for (k, v) in read_mcp_from_file(&json_path) {
            result.insert(k, v);
        }
    }

    result
}

fn write_mcp_servers(servers: &HashMap<String, Value>) -> Result<(), String> {
    let path = get_claude_json_path()
        .ok_or_else(|| "Home directory not found".to_string())?;

    let mut root: Value = if path.exists() {
        let text = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read ~/.claude.json: {e}"))?;
        serde_json::from_str(&text).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    if let Some(obj) = root.as_object_mut() {
        obj.insert(
            "mcpServers".to_string(),
            serde_json::to_value(servers)
                .map_err(|e| format!("Failed to serialize servers: {e}"))?,
        );
    }

    let content = serde_json::to_string_pretty(&root)
        .map_err(|e| format!("Failed to serialize ~/.claude.json: {e}"))?;

    atomic_write(&path, &content)
}

fn atomic_write(path: &std::path::Path, content: &str) -> Result<(), String> {
    use std::io::Write;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {e}"))?;
    }
    let tmp = path.with_extension("tmp");
    let mut f = std::fs::File::create(&tmp)
        .map_err(|e| format!("Failed to create temp file: {e}"))?;
    f.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write temp file: {e}"))?;
    f.flush().map_err(|e| format!("Failed to flush: {e}"))?;
    drop(f);
    std::fs::rename(&tmp, path)
        .map_err(|e| format!("Failed to rename temp file: {e}"))
}

/// 将单个 MCP 服务器同步到 ~/.claude.json
pub fn sync_server_to_claude(id: &str, server_spec: &Value) -> Result<(), String> {
    let mut servers = read_mcp_servers();
    servers.insert(id.to_string(), server_spec.clone());
    write_mcp_servers(&servers)
}

/// 从 ~/.claude.json 中移除单个 MCP 服务器
pub fn remove_server_from_claude(id: &str) -> Result<(), String> {
    let mut servers = read_mcp_servers();
    if servers.remove(id).is_none() {
        return Ok(());
    }
    write_mcp_servers(&servers)
}

/// 读取 ~/.claude.json 中的 mcpServers，供导入使用
pub fn read_claude_mcp_servers() -> HashMap<String, Value> {
    read_mcp_servers()
}
