use serde::Serialize;
use tauri::{AppHandle, Emitter};
use futures::StreamExt;
use tokio::io::AsyncWriteExt;

const GITHUB_REPO: &str = "cus45/ccg-switch";

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: String,
    pub download_url: Option<String>,
    pub file_size: Option<u64>,
    pub published_at: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f64,
}

/// 检查 GitHub Release 是否有新版本
pub async fn check_update(current_version: &str) -> Result<UpdateInfo, String> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", GITHUB_REPO);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let response = client
        .get(&url)
        .header("User-Agent", "CCG-Switch-Updater")
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API 请求失败: {}", response.status()));
    }

    let release: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let tag_name = release["tag_name"]
        .as_str()
        .unwrap_or("")
        .trim_start_matches('v');
    let body = release["body"].as_str().unwrap_or("");
    let published_at = release["published_at"].as_str().unwrap_or("");

    let (download_url, file_size) = find_platform_asset(&release);
    let has_update = version_is_newer(tag_name, current_version);

    Ok(UpdateInfo {
        has_update,
        current_version: current_version.to_string(),
        latest_version: tag_name.to_string(),
        release_notes: body.to_string(),
        download_url,
        file_size,
        published_at: Some(published_at.to_string()),
    })
}

/// 从 Release assets 中找到当前平台对应的安装包
fn find_platform_asset(release: &serde_json::Value) -> (Option<String>, Option<u64>) {
    let assets = match release["assets"].as_array() {
        Some(assets) => assets,
        None => return (None, None),
    };

    #[cfg(target_os = "windows")]
    {
        // 优先 NSIS .exe 安装包
        for asset in assets {
            let name = asset["name"].as_str().unwrap_or("");
            if name.ends_with("-setup.exe") {
                return (
                    asset["browser_download_url"].as_str().map(String::from),
                    asset["size"].as_u64(),
                );
            }
        }
        // 其次 .msi
        for asset in assets {
            let name = asset["name"].as_str().unwrap_or("");
            if name.ends_with(".msi") {
                return (
                    asset["browser_download_url"].as_str().map(String::from),
                    asset["size"].as_u64(),
                );
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        for asset in assets {
            let name = asset["name"].as_str().unwrap_or("");
            if name.ends_with(".dmg") {
                return (
                    asset["browser_download_url"].as_str().map(String::from),
                    asset["size"].as_u64(),
                );
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        for asset in assets {
            let name = asset["name"].as_str().unwrap_or("");
            if name.ends_with(".AppImage") {
                return (
                    asset["browser_download_url"].as_str().map(String::from),
                    asset["size"].as_u64(),
                );
            }
        }
    }

    (None, None)
}

/// 语义版本比较
fn version_is_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.').filter_map(|s| s.parse().ok()).collect()
    };
    parse(latest) > parse(current)
}

/// 下载更新安装包，通过事件推送下载进度
pub async fn download_update(app: &AppHandle, url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let response = client
        .get(url)
        .header("User-Agent", "CCG-Switch-Updater")
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?;

    let total = response.content_length().unwrap_or(0);
    let file_name = url.split('/').last().unwrap_or("update-installer.exe");

    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(file_name);

    let mut file = tokio::fs::File::create(&file_path)
        .await
        .map_err(|e| format!("创建临时文件失败: {}", e))?;

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载中断: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("写入文件失败: {}", e))?;

        downloaded += chunk.len() as u64;

        let percentage = if total > 0 {
            (downloaded as f64 / total as f64 * 100.0).min(100.0)
        } else {
            0.0
        };

        let _ = app.emit("update-download-progress", DownloadProgress {
            downloaded,
            total,
            percentage,
        });
    }

    file.flush()
        .await
        .map_err(|e| format!("文件写入失败: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// 启动安装程序
pub fn install_update(file_path: &str) -> Result<(), String> {
    std::process::Command::new(file_path)
        .spawn()
        .map_err(|e| format!("启动安装程序失败: {}", e))?;
    Ok(())
}
