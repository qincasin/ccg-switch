use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub session_count: usize,
    pub last_active: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    pub num_startups: u64,
    pub total_projects: usize,
    pub total_sessions: usize,
    pub total_history: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub date: String,
    pub count: usize,
}

fn get_claude_home() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".claude"))
}

/// 获取项目列表
pub fn list_projects() -> Result<Vec<ProjectInfo>, io::Error> {
    let projects_dir = get_claude_home()?.join("projects");
    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();

    for entry in fs::read_dir(&projects_dir)?.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }

        let dir_name = entry.file_name().to_string_lossy().to_string();
        // 将目录名转换回路径: C--guodevelop-xxx -> C:\guodevelop\xxx
        let project_path = decode_project_path(&dir_name);
        let display_name = project_path
            .split(['/', '\\'])
            .last()
            .unwrap_or(&dir_name)
            .to_string();

        // 统计 session 文件数量
        let mut session_count = 0;
        let mut latest_modified: Option<std::time::SystemTime> = None;

        if let Ok(files) = fs::read_dir(entry.path()) {
            for file in files.flatten() {
                let fname = file.file_name().to_string_lossy().to_string();
                if fname.ends_with(".jsonl") {
                    session_count += 1;
                    if let Ok(meta) = file.metadata() {
                        if let Ok(modified) = meta.modified() {
                            if latest_modified.is_none() || modified > latest_modified.unwrap() {
                                latest_modified = Some(modified);
                            }
                        }
                    }
                }
            }
        }

        let last_active = latest_modified.map(|t| {
            let duration = t
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default();
            let secs = duration.as_secs() as i64;
            // 简单格式化为 ISO 字符串
            format_timestamp(secs)
        });

        projects.push(ProjectInfo {
            name: display_name,
            path: project_path,
            session_count,
            last_active,
        });
    }

    // 按最后活跃时间倒序排列
    projects.sort_by(|a, b| b.last_active.cmp(&a.last_active));

    Ok(projects)
}

/// 获取仪表盘统计数据
pub fn get_stats() -> Result<DashboardStats, io::Error> {
    let claude_home = get_claude_home()?;

    // 读取 .claude.json 获取启动次数
    let num_startups = {
        let home = dirs::home_dir()
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
        let claude_json = home.join(".claude.json");
        if claude_json.exists() {
            let content = fs::read_to_string(&claude_json)?;
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                json.get("numStartups")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0)
            } else {
                0
            }
        } else {
            0
        }
    };

    // 统计项目数
    let projects_dir = claude_home.join("projects");
    let total_projects = if projects_dir.exists() {
        fs::read_dir(&projects_dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .count()
    } else {
        0
    };

    // 统计总 session 数
    let mut total_sessions = 0;
    if projects_dir.exists() {
        for entry in fs::read_dir(&projects_dir)?.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                if let Ok(files) = fs::read_dir(entry.path()) {
                    total_sessions += files
                        .flatten()
                        .filter(|f| {
                            f.file_name()
                                .to_string_lossy()
                                .ends_with(".jsonl")
                        })
                        .count();
                }
            }
        }
    }

    // 统计历史记录数
    let history_file = claude_home.join("history.jsonl");
    let total_history = if history_file.exists() {
        let content = fs::read_to_string(&history_file)?;
        content.lines().count()
    } else {
        0
    };

    Ok(DashboardStats {
        num_startups,
        total_projects,
        total_sessions,
        total_history,
    })
}

/// 获取历史活跃度数据（按天统计）
pub fn get_activity_history() -> Result<Vec<HistoryEntry>, io::Error> {
    let history_file = get_claude_home()?.join("history.jsonl");
    if !history_file.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&history_file)?;
    let mut date_counts: std::collections::BTreeMap<String, usize> = std::collections::BTreeMap::new();

    for line in content.lines() {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
            if let Some(ts) = json.get("timestamp").and_then(|v| v.as_i64()) {
                let date = format_date(ts / 1000); // timestamp 是毫秒
                *date_counts.entry(date).or_insert(0) += 1;
            }
        }
    }

    let entries: Vec<HistoryEntry> = date_counts
        .into_iter()
        .map(|(date, count)| HistoryEntry { date, count })
        .collect();

    Ok(entries)
}

/// 将编码的目录名转换回路径
fn decode_project_path(encoded: &str) -> String {
    // C--guodevelop-claude-switch-v1 -> C:\guodevelop\claude-switch-v1
    // 规则：开头的 X-- 表示 X:\，后续的 - 可能是路径分隔符也可能是名称中的连字符
    // 由于无法完美还原，我们尽量还原
    if encoded.len() >= 3 && &encoded[1..3] == "--" {
        let drive = &encoded[0..1];
        let rest = &encoded[3..];
        format!("{}:\\{}", drive, rest.replace('-', "\\"))
    } else {
        encoded.replace('-', "\\")
    }
}

/// 格式化时间戳为 ISO 日期时间字符串
fn format_timestamp(secs: i64) -> String {
    // 简单的时间格式化，不依赖 chrono
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;

    // 从 1970-01-01 计算日期
    let (year, month, day) = days_to_date(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:00Z",
        year, month, day, hours, minutes
    )
}

/// 格式化毫秒时间戳为日期字符串 YYYY-MM-DD
fn format_date(secs: i64) -> String {
    let days = secs / 86400;
    let (year, month, day) = days_to_date(days);
    format!("{:04}-{:02}-{:02}", year, month, day)
}

/// 将天数转换为日期
fn days_to_date(mut days: i64) -> (i64, i64, i64) {
    // 简化的日期计算
    let mut year = 1970;
    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }

    let month_days = if is_leap_year(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1;
    for &md in &month_days {
        if days < md {
            break;
        }
        days -= md;
        month += 1;
    }

    (year, month, days + 1)
}

fn is_leap_year(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub file_path: String,
    pub last_modified: Option<String>,
    pub file_size: u64,
}

/// 将项目路径编码为目录名（decode_project_path 的反向操作）
fn encode_project_path(path: &str) -> String {
    // C:\guodevelop\claude-switch-v1 -> C--guodevelop-claude-switch-v1
    let path = path.replace('/', "\\"); // normalize
    if path.len() >= 3 && &path[1..3] == ":\\" {
        let drive = &path[0..1];
        let rest = &path[3..];
        format!("{}--{}", drive, rest.replace('\\', "-"))
    } else {
        path.replace('\\', "-")
    }
}

/// 获取指定项目的会话列表
pub fn get_project_sessions(project_path: &str) -> Result<Vec<SessionInfo>, io::Error> {
    let projects_dir = get_claude_home()?.join("projects");
    let encoded = encode_project_path(project_path);
    let project_dir = projects_dir.join(&encoded);

    if !project_dir.exists() {
        return Ok(vec![]);
    }

    let mut sessions = Vec::new();

    for entry in fs::read_dir(&project_dir)?.flatten() {
        let fname = entry.file_name().to_string_lossy().to_string();
        if !fname.ends_with(".jsonl") {
            continue;
        }

        let session_id = fname.trim_end_matches(".jsonl").to_string();
        let file_path = entry.path().to_string_lossy().to_string();

        let (last_modified, file_size) = if let Ok(meta) = entry.metadata() {
            let size = meta.len();
            let modified = meta.modified().ok().map(|t| {
                let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                format_timestamp(duration.as_secs() as i64)
            });
            (modified, size)
        } else {
            (None, 0)
        };

        sessions.push(SessionInfo {
            session_id,
            file_path,
            last_modified,
            file_size,
        });
    }

    // 按最后修改时间倒序
    sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    Ok(sessions)
}
