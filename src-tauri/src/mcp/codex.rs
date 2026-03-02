use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;

/// 获取 Codex 配置目录
fn get_codex_config_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".codex")
}

/// 获取 codex 配置文件路径: ~/.codex/config.toml
fn get_codex_config_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".codex").join("config.toml"))
}

/// 检查 Codex 是否已安装（~/.codex 目录存在）
fn should_sync_codex_mcp() -> bool {
    get_codex_config_dir().exists()
}

/// 从 TOML 条目手动构建 JSON 服务器规范
/// 参考 cc-switch 的强类型字段处理
fn toml_entry_to_json_spec(entry: &toml::value::Table) -> Value {
    let typ = entry
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("stdio");

    let mut spec = serde_json::Map::new();
    spec.insert("type".into(), json!(typ));

    let core_fields: Vec<&str> = match typ {
        "stdio" => vec!["type", "command", "args", "env", "cwd"],
        "http" | "sse" => vec!["type", "url", "http_headers", "headers"],
        _ => vec!["type"],
    };

    match typ {
        "stdio" => {
            if let Some(cmd) = entry.get("command").and_then(|v| v.as_str()) {
                spec.insert("command".into(), json!(cmd));
            }
            if let Some(args) = entry.get("args").and_then(|v| v.as_array()) {
                let arr: Vec<Value> = args
                    .iter()
                    .filter_map(|x| x.as_str())
                    .map(|s| json!(s))
                    .collect();
                if !arr.is_empty() {
                    spec.insert("args".into(), Value::Array(arr));
                }
            }
            if let Some(cwd) = entry.get("cwd").and_then(|v| v.as_str()) {
                if !cwd.trim().is_empty() {
                    spec.insert("cwd".into(), json!(cwd));
                }
            }
            if let Some(env_tbl) = entry.get("env").and_then(|v| v.as_table()) {
                let mut env_json = serde_json::Map::new();
                for (k, v) in env_tbl.iter() {
                    if let Some(sv) = v.as_str() {
                        env_json.insert(k.clone(), json!(sv));
                    }
                }
                if !env_json.is_empty() {
                    spec.insert("env".into(), Value::Object(env_json));
                }
            }
        }
        "http" | "sse" => {
            if let Some(url) = entry.get("url").and_then(|v| v.as_str()) {
                spec.insert("url".into(), json!(url));
            }
            let headers_tbl = entry
                .get("http_headers")
                .and_then(|v| v.as_table())
                .or_else(|| entry.get("headers").and_then(|v| v.as_table()));
            if let Some(headers_tbl) = headers_tbl {
                let mut headers_json = serde_json::Map::new();
                for (k, v) in headers_tbl.iter() {
                    if let Some(sv) = v.as_str() {
                        headers_json.insert(k.clone(), json!(sv));
                    }
                }
                if !headers_json.is_empty() {
                    spec.insert("headers".into(), Value::Object(headers_json));
                }
            }
        }
        _ => {}
    }

    // 通用扩展字段转换
    for (key, toml_val) in entry.iter() {
        if core_fields.contains(&key.as_str()) {
            continue;
        }
        let json_val = match toml_val {
            toml::Value::String(s) => Some(json!(s)),
            toml::Value::Integer(i) => Some(json!(i)),
            toml::Value::Float(f) => Some(json!(f)),
            toml::Value::Boolean(b) => Some(json!(b)),
            toml::Value::Array(arr) => {
                let json_arr: Vec<Value> = arr
                    .iter()
                    .filter_map(|item| match item {
                        toml::Value::String(s) => Some(json!(s)),
                        toml::Value::Integer(i) => Some(json!(i)),
                        toml::Value::Float(f) => Some(json!(f)),
                        toml::Value::Boolean(b) => Some(json!(b)),
                        _ => None,
                    })
                    .collect();
                if !json_arr.is_empty() {
                    Some(Value::Array(json_arr))
                } else {
                    None
                }
            }
            toml::Value::Table(tbl) => {
                let mut json_obj = serde_json::Map::new();
                for (k, v) in tbl.iter() {
                    if let Some(s) = v.as_str() {
                        json_obj.insert(k.clone(), json!(s));
                    }
                }
                if !json_obj.is_empty() {
                    Some(Value::Object(json_obj))
                } else {
                    None
                }
            }
            _ => None,
        };
        if let Some(val) = json_val {
            spec.insert(key.clone(), val);
        }
    }

    Value::Object(spec)
}

/// JSON Value -> TOML Value 转换
fn json_to_toml_value(val: &Value) -> toml::Value {
    match val {
        Value::Null => toml::Value::String("".to_string()),
        Value::Bool(b) => toml::Value::Boolean(*b),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                toml::Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                toml::Value::Float(f)
            } else {
                toml::Value::String(n.to_string())
            }
        }
        Value::String(s) => toml::Value::String(s.clone()),
        Value::Array(arr) => {
            toml::Value::Array(arr.iter().map(json_to_toml_value).collect())
        }
        Value::Object(map) => {
            let mut table = toml::map::Map::new();
            for (k, v) in map {
                table.insert(k.clone(), json_to_toml_value(v));
            }
            toml::Value::Table(table)
        }
    }
}

/// 从 ~/.codex/config.toml 读取 MCP 服务器
/// 支持两种格式：
/// - [mcp_servers.*] — Codex 官方标准
/// - [mcp.servers.*] — 容错读取（错误格式兼容）
fn read_mcp_servers() -> HashMap<String, Value> {
    let path = match get_codex_config_path() {
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
    if text.trim().is_empty() {
        return HashMap::new();
    }
    let root: toml::Table = match toml::from_str(&text) {
        Ok(v) => v,
        Err(_) => return HashMap::new(),
    };

    let mut result = HashMap::new();

    // 1) 先处理 [mcp.servers.*]（错误格式，低优先级）
    if let Some(mcp_val) = root.get("mcp") {
        if let Some(mcp_tbl) = mcp_val.as_table() {
            if let Some(servers_val) = mcp_tbl.get("servers") {
                if let Some(servers_tbl) = servers_val.as_table() {
                    for (id, entry_val) in servers_tbl.iter() {
                        if let Some(entry_tbl) = entry_val.as_table() {
                            result.insert(id.clone(), toml_entry_to_json_spec(entry_tbl));
                        }
                    }
                }
            }
        }
    }

    // 2) 再处理 [mcp_servers.*]（正确格式，覆盖同名）
    if let Some(servers_val) = root.get("mcp_servers") {
        if let Some(servers_tbl) = servers_val.as_table() {
            for (id, entry_val) in servers_tbl.iter() {
                if let Some(entry_tbl) = entry_val.as_table() {
                    result.insert(id.clone(), toml_entry_to_json_spec(entry_tbl));
                }
            }
        }
    }

    result
}

/// 写入 MCP 服务器到 ~/.codex/config.toml 的 [mcp_servers] 段
/// 保留其他根配置不变
fn write_mcp_servers(servers: &HashMap<String, Value>) -> Result<(), String> {
    let path = get_codex_config_path()
        .ok_or_else(|| "Home directory not found".to_string())?;

    // 如果 ~/.codex 目录不存在，不创建
    if !should_sync_codex_mcp() {
        return Ok(());
    }

    let mut root: toml::Value = if path.exists() {
        let text = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read codex config.toml: {e}"))?;
        if text.trim().is_empty() {
            toml::Value::Table(toml::map::Map::new())
        } else {
            text.parse()
                .map_err(|e| format!("Failed to parse codex config.toml: {e}"))?
        }
    } else {
        toml::Value::Table(toml::map::Map::new())
    };

    // 清理可能存在的错误格式 [mcp.servers]
    if let Some(table) = root.as_table_mut() {
        if let Some(mcp_val) = table.get_mut("mcp") {
            if let Some(mcp_tbl) = mcp_val.as_table_mut() {
                mcp_tbl.remove("servers");
            }
        }
    }

    // 构建 mcp_servers 表
    let mut mcp_table = toml::map::Map::new();
    for (id, spec) in servers {
        mcp_table.insert(id.clone(), json_to_toml_value(spec));
    }

    if let Some(table) = root.as_table_mut() {
        if mcp_table.is_empty() {
            table.remove("mcp_servers");
        } else {
            table.insert("mcp_servers".to_string(), toml::Value::Table(mcp_table));
        }
    }

    let content = toml::to_string_pretty(&root)
        .map_err(|e| format!("Failed to serialize codex config.toml: {e}"))?;

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

/// 将单个 MCP 服务器同步到 ~/.codex/config.toml
pub fn sync_server_to_codex(id: &str, server_spec: &Value) -> Result<(), String> {
    if !should_sync_codex_mcp() {
        return Ok(());
    }
    let mut servers = read_mcp_servers();
    servers.insert(id.to_string(), server_spec.clone());
    write_mcp_servers(&servers)
}

/// 从 ~/.codex/config.toml 中移除单个 MCP 服务器
pub fn remove_server_from_codex(id: &str) -> Result<(), String> {
    if !should_sync_codex_mcp() {
        return Ok(());
    }
    let mut servers = read_mcp_servers();
    if servers.remove(id).is_none() {
        return Ok(());
    }
    write_mcp_servers(&servers)
}

/// 读取 ~/.codex/config.toml 中的 MCP 服务器，供导入使用
pub fn read_codex_mcp_servers() -> HashMap<String, Value> {
    read_mcp_servers()
}
