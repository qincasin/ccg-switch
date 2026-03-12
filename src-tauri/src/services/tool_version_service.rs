use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::RwLock;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolVersion {
    pub name: String,
    pub version: Option<String>,
    pub latest_version: Option<String>,
    pub error: Option<String>,
}

const VALID_TOOLS: [&str; 4] = ["claude", "codex", "gemini", "opencode"];

/// 预编译的版本号正则
static VERSION_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\d+\.\d+\.\d+(-[\w.]+)?").expect("Invalid version regex"));

/// 缓存：(结果, 缓存时间)
static CACHE: Lazy<Arc<RwLock<Option<(Vec<ToolVersion>, std::time::Instant)>>>> =
    Lazy::new(|| Arc::new(RwLock::new(None)));

/// 缓存有效期：5分钟
const CACHE_TTL: std::time::Duration = std::time::Duration::from_secs(300);

fn extract_version(raw: &str) -> String {
    VERSION_RE
        .find(raw)
        .map(|m| m.as_str().to_string())
        .unwrap_or_else(|| raw.to_string())
}

/// 获取多个工具的本地版本和远程最新版本（支持缓存和强制刷新）
pub async fn get_tool_versions(tools: Option<Vec<String>>, force: bool) -> Vec<ToolVersion> {
    // 非强制刷新时检查缓存
    if !force {
        let cache = CACHE.read().await;
        if let Some((ref cached, ref cached_at)) = *cache {
            if cached_at.elapsed() < CACHE_TTL {
                if let Some(ref tools) = tools {
                    let set: std::collections::HashSet<&str> =
                        tools.iter().map(|s| s.as_str()).collect();
                    return cached
                        .iter()
                        .filter(|t| set.contains(t.name.as_str()))
                        .cloned()
                        .collect();
                }
                return cached.clone();
            }
        }
    }

    let requested: Vec<String> = if let Some(ref tools) = tools {
        let set: std::collections::HashSet<&str> = tools.iter().map(|s| s.as_str()).collect();
        VALID_TOOLS
            .iter()
            .copied()
            .filter(|t| set.contains(t))
            .map(|s| s.to_string())
            .collect()
    } else {
        VALID_TOOLS.iter().map(|s| s.to_string()).collect()
    };

    // 并行检查所有工具
    let futures: Vec<_> = requested
        .into_iter()
        .map(|tool| async move { get_single_tool_version(&tool).await })
        .collect();

    let results = futures::future::join_all(futures).await;

    // 请求全部工具时更新缓存
    if tools.is_none() {
        let mut cache = CACHE.write().await;
        *cache = Some((results.clone(), std::time::Instant::now()));
    }

    results
}

async fn get_single_tool_version(tool: &str) -> ToolVersion {
    let tool_name = tool.to_string();

    // 1. 用 spawn_blocking 非阻塞获取本地版本
    let tool_for_local = tool_name.clone();
    let (local_version, local_error) = tokio::task::spawn_blocking(move || {
        try_get_version(&tool_for_local)
    })
    .await
    .unwrap_or((None, Some("检测超时".to_string())));

    // 2. 获取远程最新版本
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    let latest_version = match tool_name.as_str() {
        "claude" => fetch_npm_latest(&client, "@anthropic-ai/claude-code").await,
        "codex" => fetch_npm_latest(&client, "@openai/codex").await,
        "gemini" => fetch_npm_latest(&client, "@google/gemini-cli").await,
        "opencode" => fetch_github_latest(&client, "anomalyco/opencode").await,
        _ => None,
    };

    ToolVersion {
        name: tool_name,
        version: local_version,
        latest_version,
        error: local_error,
    }
}

fn try_get_version(tool: &str) -> (Option<String>, Option<String>) {
    use std::process::Command;

    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(["/C", &format!("{tool} --version")])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("sh")
        .arg("-c")
        .arg(format!("{tool} --version"))
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            if out.status.success() {
                let raw = if stdout.is_empty() { &stderr } else { &stdout };
                if raw.is_empty() {
                    (None, Some("未安装".to_string()))
                } else {
                    (Some(extract_version(raw)), None)
                }
            } else {
                (None, Some("未安装".to_string()))
            }
        }
        Err(_) => (None, Some("未安装".to_string())),
    }
}

async fn fetch_npm_latest(client: &reqwest::Client, package: &str) -> Option<String> {
    let url = format!("https://registry.npmjs.org/{package}");
    let resp = client.get(&url).send().await.ok()?;
    let json = resp.json::<serde_json::Value>().await.ok()?;
    json.get("dist-tags")
        .and_then(|tags| tags.get("latest"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

async fn fetch_github_latest(client: &reqwest::Client, repo: &str) -> Option<String> {
    let url = format!("https://api.github.com/repos/{repo}/releases/latest");
    let resp = client
        .get(&url)
        .header("User-Agent", "ccg-switch")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .ok()?;
    let json = resp.json::<serde_json::Value>().await.ok()?;
    json.get("tag_name")
        .and_then(|v| v.as_str())
        .map(|s| s.strip_prefix('v').unwrap_or(s).to_string())
}
