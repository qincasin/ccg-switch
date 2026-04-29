pub mod providers;

use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub provider_id: String,
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_dir: Option<String>,
    pub created_at: i64,
    pub last_active_at: i64,
    pub source_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resume_command: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct UnifiedSessionMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ts: Option<String>,
}

/// 按项目路径扫描会话，合并所有 provider 并按 last_active_at 降序排序
pub fn scan_sessions_for_project(project_path: &str) -> Vec<SessionMeta> {
    let mut all = Vec::new();
    all.extend(providers::claude::scan_claude_sessions_for_project(
        project_path,
    ));
    all.extend(providers::codex::scan_codex_sessions_for_project(
        project_path,
    ));
    all.extend(providers::gemini::scan_gemini_sessions_for_project(
        project_path,
    ));
    all.sort_by(|a, b| b.last_active_at.cmp(&a.last_active_at));
    all
}

/// 轻量扫描：返回每个项目路径拥有哪些 provider 的映射
/// 不读取标题/内容，只检查目录结构和 cwd 字段
pub fn get_project_provider_map(project_paths: &[String]) -> HashMap<String, Vec<String>> {
    let normalized: Vec<String> = project_paths
        .iter()
        .map(|p| p.replace('\\', "/").to_lowercase())
        .collect();

    let mut result: HashMap<String, Vec<String>> = HashMap::new();
    // 初始化每个项目
    for path in project_paths {
        result.insert(path.clone(), vec!["claude".to_string()]); // 所有项目都来自 Claude
    }

    // Codex: 快速扫描 cwd 字段
    let codex_projects = providers::codex::scan_codex_project_dirs();
    for codex_dir in &codex_projects {
        let norm = codex_dir.replace('\\', "/").to_lowercase();
        for (i, target) in normalized.iter().enumerate() {
            if norm == *target {
                let entry = result.entry(project_paths[i].clone()).or_default();
                if !entry.contains(&"codex".to_string()) {
                    entry.push("codex".to_string());
                }
            }
        }
    }

    // Gemini: 从 projects.json 读取
    let gemini_projects = providers::gemini::scan_gemini_project_dirs();
    for gemini_dir in &gemini_projects {
        let norm = gemini_dir.replace('\\', "/").to_lowercase();
        for (i, target) in normalized.iter().enumerate() {
            if norm == *target {
                let entry = result.entry(project_paths[i].clone()).or_default();
                if !entry.contains(&"gemini".to_string()) {
                    entry.push("gemini".to_string());
                }
            }
        }
    }

    result
}

/// 根据 provider_id 路由到对应 provider 加载消息
pub fn load_messages(
    provider_id: &str,
    source_path: &str,
) -> Result<Vec<UnifiedSessionMessage>, String> {
    match provider_id {
        "claude" => providers::claude::load_claude_messages(source_path),
        "codex" => providers::codex::load_codex_messages(source_path),
        "gemini" => providers::gemini::load_gemini_messages(source_path),
        _ => Err(format!("Unknown provider: {}", provider_id)),
    }
}
