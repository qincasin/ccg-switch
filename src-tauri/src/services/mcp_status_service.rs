use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use crate::database::Database;
use futures::StreamExt;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum McpStatus {
    Online,
    Offline,
    Timeout,
    Error,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatusResult {
    pub server_id: String,
    pub status: McpStatus,
    pub message: Option<String>,
    pub latency_ms: Option<u64>,
}

/// HTTP/SSE 类型 MCP 服务器检测
async fn check_http(server_id: String, url: &str) -> McpStatusResult {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build();

    let client = match client {
        Ok(c) => c,
        Err(e) => {
            return McpStatusResult {
                server_id,
                status: McpStatus::Error,
                message: Some(format!("Failed to create HTTP client: {e}")),
                latency_ms: None,
            };
        }
    };

    let start = std::time::Instant::now();
    let result = client.get(url).send().await;

    match result {
        Ok(response) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            if response.status().is_success() || response.status().is_redirection() {
                McpStatusResult {
                    server_id,
                    status: McpStatus::Online,
                    message: None,
                    latency_ms: Some(latency_ms),
                }
            } else {
                McpStatusResult {
                    server_id,
                    status: McpStatus::Error,
                    message: Some(format!("HTTP {}", response.status().as_u16())),
                    latency_ms: Some(latency_ms),
                }
            }
        }
        Err(e) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            if e.is_timeout() {
                McpStatusResult {
                    server_id,
                    status: McpStatus::Timeout,
                    message: Some("Connection timed out (10s)".to_string()),
                    latency_ms: Some(latency_ms),
                }
            } else if e.is_connect() {
                McpStatusResult {
                    server_id,
                    status: McpStatus::Offline,
                    message: Some("Connection refused".to_string()),
                    latency_ms: Some(latency_ms),
                }
            } else {
                McpStatusResult {
                    server_id,
                    status: McpStatus::Error,
                    message: Some(format!("Request failed: {e}")),
                    latency_ms: Some(latency_ms),
                }
            }
        }
    }
}

/// stdio 类型 MCP 服务器检测 — 检测命令能否启动
async fn check_stdio(
    server_id: String,
    command: &str,
    args: &[String],
    env: &std::collections::HashMap<String, String>,
) -> McpStatusResult {
    let full_command = if args.is_empty() {
        command.to_string()
    } else {
        format!("{} {}", command, args.join(" "))
    };

    let env_clone = env.clone();
    let cmd_clone = full_command.clone();

    let start = std::time::Instant::now();

    let spawn_result = tokio::time::timeout(
        Duration::from_secs(5),
        tokio::task::spawn_blocking(move || {
            use std::process::Command;

            #[cfg(target_os = "windows")]
            let mut cmd = {
                let mut c = Command::new("cmd");
                c.args(["/C", &cmd_clone]);
                c.creation_flags(CREATE_NO_WINDOW);
                c
            };

            #[cfg(not(target_os = "windows"))]
            let mut cmd = {
                let mut c = Command::new("sh");
                c.arg("-c").arg(&cmd_clone);
                c
            };

            // 设置环境变量
            for (key, value) in &env_clone {
                cmd.env(key, value);
            }

            // 只需检测命令能否启动，不需要等待完成
            cmd.stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()
        }),
    )
    .await;

    let latency_ms = start.elapsed().as_millis() as u64;

    match spawn_result {
        Ok(Ok(spawn_res)) => match spawn_res {
            Ok(mut child) => {
                // 进程成功启动，立即 kill 掉
                let _ = child.kill();
                let _ = child.wait();
                McpStatusResult {
                    server_id,
                    status: McpStatus::Online,
                    message: None,
                    latency_ms: Some(latency_ms),
                }
            }
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("not found") || msg.contains("No such file") || msg.contains("cannot find") {
                    McpStatusResult {
                        server_id,
                        status: McpStatus::Offline,
                        message: Some("Command not found".to_string()),
                        latency_ms: Some(latency_ms),
                    }
                } else {
                    McpStatusResult {
                        server_id,
                        status: McpStatus::Error,
                        message: Some(format!("Failed to start: {msg}")),
                        latency_ms: Some(latency_ms),
                    }
                }
            }
        },
        Ok(Err(_)) => McpStatusResult {
            server_id,
            status: McpStatus::Error,
            message: Some("Internal task error".to_string()),
            latency_ms: Some(latency_ms),
        },
        Err(_) => McpStatusResult {
            server_id,
            status: McpStatus::Timeout,
            message: Some("Process detection timed out (5s)".to_string()),
            latency_ms: Some(latency_ms),
        },
    }
}

/// 根据 server_config 检测单个 MCP 服务器状态
async fn check_single(server_id: String, config: &serde_json::Value) -> McpStatusResult {
    let server_type = config
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("stdio");

    match server_type {
        "http" | "sse" => {
            let url = match config.get("url").and_then(|v| v.as_str()) {
                Some(u) => u,
                None => {
                    return McpStatusResult {
                        server_id,
                        status: McpStatus::Unknown,
                        message: Some("Missing 'url' in config".to_string()),
                        latency_ms: None,
                    };
                }
            };
            check_http(server_id, url).await
        }
        _ => {
            // stdio 或其他类型
            let command = match config.get("command").and_then(|v| v.as_str()) {
                Some(c) => c,
                None => {
                    return McpStatusResult {
                        server_id,
                        status: McpStatus::Unknown,
                        message: Some("Missing 'command' in config".to_string()),
                        latency_ms: None,
                    };
                }
            };

            let args: Vec<String> = config
                .get("args")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            let env: std::collections::HashMap<String, String> = config
                .get("env")
                .and_then(|v| v.as_object())
                .map(|obj| {
                    obj.iter()
                        .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                        .collect()
                })
                .unwrap_or_default();

            check_stdio(server_id, command, &args, &env).await
        }
    }
}

/// 批量检测 MCP 服务器状态（并发上限 5）
pub async fn check_batch(
    db: &Arc<Database>,
    server_ids: Vec<String>,
) -> Result<Vec<McpStatusResult>, String> {
    let all_servers = db.get_all_mcp_servers()?;

    let futures: Vec<_> = server_ids
        .into_iter()
        .map(|id| {
            let server = all_servers.get(&id).cloned();
            async move {
                match server {
                    Some(row) => check_single(id, &row.server_config).await,
                    None => McpStatusResult {
                        server_id: id,
                        status: McpStatus::Unknown,
                        message: Some("Server not found in database".to_string()),
                        latency_ms: None,
                    },
                }
            }
        })
        .collect();

    let results: Vec<McpStatusResult> = futures::stream::iter(futures)
        .buffer_unordered(5)
        .collect()
        .await;

    Ok(results)
}
