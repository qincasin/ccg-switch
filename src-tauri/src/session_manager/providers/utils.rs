use regex::Regex;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// 获取用户主目录
pub fn home_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir()
}

/// 截断文本，超出 max_chars 时追加 "..."
pub fn truncate_text(text: &str, max_chars: usize) -> String {
    let mut out = String::new();
    let mut count = 0;
    for ch in text.chars() {
        if count >= max_chars {
            break;
        }
        out.push(ch);
        count += 1;
    }

    if text.chars().count() > max_chars {
        out.push_str("...");
    }

    out
}

/// Claude Code 内部标签名列表（这些标签会被完整移除，包括内容）
const SYSTEM_TAGS_REMOVE_CONTENT: &[&str] =
    &["local-command-caveat", "system-reminder", "command-args"];

/// Claude Code 内部标签名列表（这些标签移除标签但保留内容）
const SYSTEM_TAGS_KEEP_CONTENT: &[&str] = &[
    "command-name",
    "command-message",
    "teammate-message",
    "user-prompt-submit-hook",
    "antml_thinking",
];

/// 移除 XML 标签，根据标签类型决定是否保留内容
fn strip_xml_tags(text: &str) -> String {
    let mut result = text.to_string();

    // 先移除需要连同内容一起删除的标签（如 <local-command-caveat>...</local-command-caveat>）
    for tag in SYSTEM_TAGS_REMOVE_CONTENT {
        // 匹配 <tag ...>...</tag> 和自闭合 <tag .../>
        let pattern = format!(r"(?s)<{0}[^>]*>.*?</{0}>|<{0}[^>]*/?>", tag);
        if let Ok(re) = Regex::new(&pattern) {
            result = re.replace_all(&result, "").to_string();
        }
    }

    // 移除标签但保留内容（如 <command-name>/commit</command-name> → /commit）
    for tag in SYSTEM_TAGS_KEEP_CONTENT {
        let open_pattern = format!(r"<{0}[^>]*>", tag);
        let close_pattern = format!(r"</{0}>", tag);
        if let Ok(re) = Regex::new(&open_pattern) {
            result = re.replace_all(&result, "").to_string();
        }
        if let Ok(re) = Regex::new(&close_pattern) {
            result = re.replace_all(&result, "").to_string();
        }
    }

    result
}

/// 判断文本是否为纯系统/命令消息（不适合作为标题）
pub fn is_system_message(text: &str) -> bool {
    let trimmed = text.trim();
    // 以系统标签开头的消息
    if trimmed.starts_with("<local-command-caveat")
        || trimmed.starts_with("<system-reminder")
        || trimmed.starts_with("<command-name>")
    {
        // 检查清理后是否只剩命令名（无实际用户内容）
        let cleaned = strip_xml_tags(trimmed);
        let cleaned = cleaned.trim();
        if cleaned.is_empty() {
            return true;
        }
        // 仅包含斜杠命令（如 /clear, /compact）
        if cleaned.starts_with('/') && !cleaned.contains(' ') {
            return true;
        }
    }
    false
}

/// 清理会话文本：去除 XML 标签、idle 通知、空行，合并空白
pub fn sanitize_session_text(text: &str) -> String {
    // 先清理 XML 标签
    let stripped = strip_xml_tags(text);

    let mut lines: Vec<String> = Vec::new();
    for raw_line in stripped.replace('\r', "").lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        if line.contains("\"type\":\"idle_notification\"") {
            continue;
        }
        if line == "[Request interrupted by user]" || line == "No response requested." {
            continue;
        }
        lines.push(line.to_string());
    }

    lines
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// 从消息内容中提取纯文本（支持 string 和 array 格式）
pub fn extract_message_text(content: &serde_json::Value) -> Option<String> {
    if let Some(text) = content.as_str() {
        return Some(text.to_string());
    }

    if let Some(items) = content.as_array() {
        for item in items {
            if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                if !text.trim().is_empty() {
                    return Some(text.to_string());
                }
            }
        }
    }

    None
}

/// 从 teammate 标签中提取 summary 属性
pub fn extract_teammate_summary(text: &str) -> Option<String> {
    let marker = "summary=\"";
    let start = text.find(marker)?;
    let summary_start = start + marker.len();
    let remaining = &text[summary_start..];
    let end = remaining.find('"')?;
    let summary = remaining[..end].trim();
    if summary.is_empty() {
        None
    } else {
        Some(summary.to_string())
    }
}

/// 读取文件末尾 max_bytes 字节的文本
#[allow(dead_code)]
pub fn read_tail_text(path: &Path, max_bytes: u64) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    let size = file.metadata().ok()?.len();
    let start = size.saturating_sub(max_bytes);
    if file.seek(SeekFrom::Start(start)).is_err() {
        return None;
    }

    let mut buf = Vec::new();
    if file.read_to_end(&mut buf).is_err() {
        return None;
    }
    Some(String::from_utf8_lossy(&buf).to_string())
}
