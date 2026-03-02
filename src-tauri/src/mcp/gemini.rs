use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;

fn get_gemini_settings_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".gemini").join("settings.json"))
}

/// 检查 Gemini 是否已安装（~/.gemini 目录存在）
fn should_sync_gemini_mcp() -> bool {
    dirs::home_dir()
        .map(|h| h.join(".gemini").exists())
        .unwrap_or(false)
}

/// 读取 ~/.gemini/settings.json 中的 mcpServers
/// 执行反向格式转换以保持与统一 MCP 结构的兼容性：
/// - httpUrl → url + type: "http"
/// - 仅有 url 字段 → 补齐 type: "sse"
/// - 仅有 command 字段 → 补齐 type: "stdio"
fn read_mcp_servers() -> HashMap<String, Value> {
    let path = match get_gemini_settings_path() {
        Some(p) => p,
        None => return HashMap::new(),
    };
    if !path.exists() {
        return HashMap::new();
    }
    let text = match std::fs::read_to_string(&path) {
        Ok(t) => t,
        Err(_) => return HashMap::new(),
    };
    let val: Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => return HashMap::new(),
    };

    let mut servers: HashMap<String, Value> = val
        .get("mcpServers")
        .and_then(|v| v.as_object())
        .map(|m| m.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();

    // 反向格式转换：Gemini 特有格式 → 统一 MCP 格式
    for (_, spec) in servers.iter_mut() {
        if let Some(obj) = spec.as_object_mut() {
            // httpUrl → url + type: "http"
            if let Some(http_url) = obj.remove("httpUrl") {
                obj.insert("url".to_string(), http_url);
                obj.insert("type".to_string(), json!("http"));
            }

            // Gemini CLI 不使用 type 字段：补齐成统一结构
            if obj.get("type").is_none() {
                if obj.contains_key("command") {
                    obj.insert("type".to_string(), json!("stdio"));
                } else if obj.contains_key("url") {
                    obj.insert("type".to_string(), json!("sse"));
                }
            }
        }
    }

    servers
}

/// 写入 MCP 服务器到 ~/.gemini/settings.json
/// 执行正向格式转换：统一 MCP 格式 → Gemini 特有格式
fn write_mcp_servers(servers: &HashMap<String, Value>) -> Result<(), String> {
    let path = get_gemini_settings_path()
        .ok_or_else(|| "Home directory not found".to_string())?;

    if !should_sync_gemini_mcp() {
        return Ok(());
    }

    let mut root: Value = if path.exists() {
        let text = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read gemini settings: {e}"))?;
        serde_json::from_str(&text).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    };

    // 构建 mcpServers 对象，执行格式转换
    let mut out = serde_json::Map::new();
    for (id, spec) in servers {
        let mut obj = match spec.as_object() {
            Some(map) => map.clone(),
            None => continue,
        };

        // 正向格式转换：统一格式 → Gemini 格式
        let transport_type = obj.get("type").and_then(|v| v.as_str()).map(|s| s.to_string());
        if transport_type.as_deref() == Some("http") {
            // HTTP: 将 url 重命名为 httpUrl
            if let Some(url_value) = obj.remove("url") {
                obj.insert("httpUrl".to_string(), url_value);
            }
        }
        // SSE 保持 url 字段不变

        // 移除 type 字段（Gemini 不需要）
        obj.remove("type");
        // 移除 UI 辅助字段
        obj.remove("enabled");
        obj.remove("source");
        obj.remove("id");
        obj.remove("name");
        obj.remove("description");
        obj.remove("tags");

        out.insert(id.clone(), Value::Object(obj));
    }

    if let Some(root_obj) = root.as_object_mut() {
        root_obj.insert("mcpServers".to_string(), Value::Object(out));
    }

    let content = serde_json::to_string_pretty(&root)
        .map_err(|e| format!("Failed to serialize gemini settings: {e}"))?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {e}"))?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, content)
        .map_err(|e| format!("Failed to write temp file: {e}"))?;
    std::fs::rename(&tmp, &path)
        .map_err(|e| format!("Failed to rename temp file: {e}"))
}

/// 将单个 MCP 服务器同步到 ~/.gemini/settings.json
pub fn sync_server_to_gemini(id: &str, server_spec: &Value) -> Result<(), String> {
    if !should_sync_gemini_mcp() {
        return Ok(());
    }
    let mut servers = read_mcp_servers();
    servers.insert(id.to_string(), server_spec.clone());
    write_mcp_servers(&servers)
}

/// 从 ~/.gemini/settings.json 中移除单个 MCP 服务器
pub fn remove_server_from_gemini(id: &str) -> Result<(), String> {
    if !should_sync_gemini_mcp() {
        return Ok(());
    }
    let mut servers = read_mcp_servers();
    if servers.remove(id).is_none() {
        return Ok(());
    }
    write_mcp_servers(&servers)
}

/// 读取 ~/.gemini/settings.json 中的 mcpServers，供导入使用
pub fn read_gemini_mcp_servers() -> HashMap<String, Value> {
    read_mcp_servers()
}
