use super::utils::{
    extract_message_text, extract_teammate_summary, home_dir, is_system_message,
    sanitize_session_text, truncate_text,
};
use crate::session_manager::{SessionMeta, UnifiedSessionMessage};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

/// 按项目路径扫描 Claude 会话（只扫描匹配的项目目录）
pub fn scan_claude_sessions_for_project(project_path: &str) -> Vec<SessionMeta> {
    let home = match home_dir() {
        Some(h) => h,
        None => return vec![],
    };

    let projects_dir = home.join(".claude").join("projects");
    if !projects_dir.exists() {
        return vec![];
    }

    // 找到匹配 project_path 的项目目录
    let target_dir = find_project_dir(&projects_dir, project_path);
    let target_dir = match target_dir {
        Some(d) => d,
        None => return vec![],
    };

    scan_sessions_in_dir(&target_dir, project_path)
}

/// 在 ~/.claude/projects/ 中找到匹配给定路径的项目目录
fn find_project_dir(projects_dir: &Path, project_path: &str) -> Option<PathBuf> {
    let normalized = normalize_path(project_path);
    let entries = fs::read_dir(projects_dir).ok()?;

    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let dir = entry.path();

        // 快速检查：读取第一个 .jsonl 的 cwd 字段
        if let Some(cwd) = extract_cwd_from_first_file(&dir) {
            if normalize_path(&cwd) == normalized {
                return Some(dir);
            }
        }
    }
    None
}

/// 从目录中第一个 .jsonl 文件提取 cwd
fn extract_cwd_from_first_file(dir: &Path) -> Option<String> {
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            if let Some(cwd) = extract_cwd(&path) {
                return Some(cwd);
            }
        }
    }
    None
}

/// 规范化路径用于比较（统一斜杠方向和大小写）
fn normalize_path(p: &str) -> String {
    p.replace('\\', "/").to_lowercase()
}

/// 扫描指定目录下的所有会话文件
fn scan_sessions_in_dir(dir: &Path, project_path: &str) -> Vec<SessionMeta> {
    let mut sessions = Vec::new();
    let jsonl_files = collect_jsonl_files(dir);

    for path in jsonl_files {
        let fname = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        if fname.starts_with("agent-") {
            continue;
        }

        let session_id = fname.trim_end_matches(".jsonl").to_string();
        let source_path = path.to_string_lossy().to_string();
        let (title, summary) = extract_title_and_summary(&path);

        let (created_at, last_active_at) = match fs::metadata(&path) {
            Ok(meta) => {
                let modified = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);
                let created = meta
                    .created()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(modified);
                (created, modified)
            }
            Err(_) => (0, 0),
        };

        sessions.push(SessionMeta {
            provider_id: "claude".to_string(),
            session_id: session_id.clone(),
            title,
            summary,
            project_dir: Some(project_path.to_string()),
            created_at,
            last_active_at,
            source_path,
            resume_command: Some(format!("claude --resume {}", session_id)),
        });
    }

    sessions
}

/// 加载 Claude 会话的所有消息
pub fn load_claude_messages(source_path: &str) -> Result<Vec<UnifiedSessionMessage>, String> {
    let path = Path::new(source_path);
    if !path.exists() {
        return Err("Session file not found".to_string());
    }

    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut messages = Vec::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let json: serde_json::Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => continue,
        };

        // 跳过 meta 行
        if json.get("isMeta").and_then(|v| v.as_bool()) == Some(true) {
            continue;
        }

        let msg_type = json
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        if msg_type != "user" && msg_type != "assistant" {
            continue;
        }

        let message_content = match json.get("message").and_then(|v| v.get("content")) {
            Some(content) => content,
            None => continue,
        };

        let raw_text = match extract_message_text(message_content) {
            Some(text) => text,
            None => continue,
        };
        let clean_text = sanitize_session_text(&raw_text);
        if clean_text.is_empty() {
            continue;
        }

        let ts = json
            .get("timestamp")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        messages.push(UnifiedSessionMessage {
            role: msg_type.to_string(),
            content: clean_text,
            ts,
        });
    }

    Ok(messages)
}

/// 递归收集目录下所有 .jsonl 文件
fn collect_jsonl_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    collect_jsonl_inner(dir, &mut files);
    files
}

fn collect_jsonl_inner(dir: &Path, files: &mut Vec<PathBuf>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl_inner(&path, files);
        } else if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            files.push(path);
        }
    }
}

/// 从 .jsonl 前 20 行提取 cwd 字段
fn extract_cwd(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let reader = BufReader::new(file);
    for line in reader.lines().take(20).flatten() {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
            if let Some(cwd) = json.get("cwd").and_then(|v| v.as_str()) {
                if !cwd.is_empty() {
                    return Some(cwd.to_string());
                }
            }
        }
    }
    None
}

/// 从 .jsonl 前 240 行提取 title 和 summary
fn extract_title_and_summary(path: &Path) -> (Option<String>, Option<String>) {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (None, None),
    };

    let reader = BufReader::new(file);
    let mut title: Option<String> = None;
    let mut summary: Option<String> = None;

    for line in reader.lines().take(240).flatten() {
        if line.trim().is_empty() {
            continue;
        }

        let json: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        if title.is_some() && summary.is_some() {
            break;
        }

        let msg_type = json
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        if msg_type != "user" {
            continue;
        }

        let message_content = match json.get("message").and_then(|v| v.get("content")) {
            Some(content) => content,
            None => continue,
        };

        let raw_text = match extract_message_text(message_content) {
            Some(text) => text,
            None => continue,
        };

        // 优先从 teammate 标签提取 summary 作为 title
        if let Some(teammate_summary) = extract_teammate_summary(&raw_text) {
            let short = truncate_text(&teammate_summary, 80);
            if !short.is_empty() {
                title = Some(short);
            }
        }

        // 跳过纯系统/命令消息（如 <local-command-caveat>、/clear 等）
        if is_system_message(&raw_text) {
            continue;
        }

        let clean_text = sanitize_session_text(&raw_text);
        if clean_text.is_empty() {
            continue;
        }

        if title.is_none() {
            title = Some(truncate_text(&clean_text, 80));
        }

        if summary.is_none() {
            summary = Some(truncate_text(&clean_text, 140));
        }
    }

    (title, summary)
}
