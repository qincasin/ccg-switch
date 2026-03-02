//! Skills 数据库版服务层 (v2)
//!
//! SSOT 目录: ~/.claude-switch/skills/<directory>/
//! 应用目录: ~/.claude/skills/ / ~/.codex/skills/ / ~/.gemini/skills/

use crate::database::dao::skills::{InstalledSkillRow, SkillRepo};
use crate::database::Database;
use crate::services::skill_discovery::{discover_available, download_skill_to_ssot, DiscoverableSkill};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

// ========== 路径管理 ==========

fn get_ssot_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取 HOME 目录")?;
    let dir = home.join(".claude-switch").join("skills");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn get_app_skills_dir(app: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取 HOME 目录")?;
    let dir = match app {
        "claude" => home.join(".claude").join("skills"),
        "codex" => home.join(".codex").join("skills"),
        "gemini" => home.join(".gemini").join("skills"),
        _ => return Err(format!("不支持的 app: {}", app)),
    };
    Ok(dir)
}

// ========== 文件同步 ==========

/// 将 SSOT skill 目录复制到应用目录
fn sync_to_app_dir(directory: &str, app: &str) -> Result<(), String> {
    let ssot_dir = get_ssot_dir()?;
    let src = ssot_dir.join(directory);
    if !src.exists() {
        return Ok(());
    }

    let app_dir = get_app_skills_dir(app)?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let dst = app_dir.join(directory);

    // 删除旧的再复制
    if dst.exists() {
        if dst.is_dir() {
            fs::remove_dir_all(&dst).map_err(|e| e.to_string())?;
        } else {
            fs::remove_file(&dst).map_err(|e| e.to_string())?;
        }
    }

    copy_dir(&src, &dst)
}

/// 从应用目录删除 skill
fn remove_from_app_dir(directory: &str, app: &str) {
    if let Ok(app_dir) = get_app_skills_dir(app) {
        let path = app_dir.join(directory);
        if path.exists() {
            if path.is_dir() {
                let _ = fs::remove_dir_all(&path);
            } else {
                let _ = fs::remove_file(&path);
            }
        }
    }
}

fn copy_dir(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ty = entry.file_type().map_err(|e| e.to_string())?;
        let dest = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir(&entry.path(), &dest)?;
        } else {
            fs::copy(entry.path(), dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// ========== SkillServiceV2 ==========

pub struct SkillServiceV2;

impl SkillServiceV2 {
    /// 获取所有已安装的 Skills
    pub fn get_all_installed(db: &Arc<Database>) -> Result<Vec<InstalledSkillRow>, String> {
        let map = db.get_all_installed_skills()?;
        let mut skills: Vec<InstalledSkillRow> = map.into_values().collect();
        skills.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(skills)
    }

    /// 安装 Skill
    ///
    /// 1. 下载到 SSOT 目录
    /// 2. 保存到数据库（默认启用 claude）
    /// 3. 同步到已启用的应用目录
    pub async fn install(
        db: &Arc<Database>,
        skill: &DiscoverableSkill,
        current_app: &str,
    ) -> Result<InstalledSkillRow, String> {
        // 检查是否已安装
        let existing = db.get_all_installed_skills()?;
        for row in existing.values() {
            if row.directory.eq_ignore_ascii_case(&skill.directory) {
                return Err(format!("Skill '{}' 已安装", skill.directory));
            }
        }

        let ssot_dir = get_ssot_dir()?;
        download_skill_to_ssot(skill, &ssot_dir).await?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        let mut row = InstalledSkillRow {
            id: uuid::Uuid::new_v4().to_string(),
            name: skill.name.clone(),
            description: Some(skill.description.clone()),
            directory: skill.directory.clone(),
            repo_owner: Some(skill.repo_owner.clone()),
            repo_name: Some(skill.repo_name.clone()),
            repo_branch: Some(skill.repo_branch.clone()),
            readme_url: skill.readme_url.clone(),
            enabled_claude: current_app == "claude",
            enabled_codex: current_app == "codex",
            enabled_gemini: current_app == "gemini",
            installed_at: now,
        };

        db.save_skill(&row)?;

        // 同步到启用的应用目录
        for app in ["claude", "codex", "gemini"] {
            if Self::app_enabled(&row, app) {
                let _ = sync_to_app_dir(&row.directory, app);
            }
        }

        Ok(row)
    }

    /// 卸载 Skill
    pub fn uninstall(db: &Arc<Database>, id: &str) -> Result<(), String> {
        let skills = db.get_all_installed_skills()?;
        if let Some(row) = skills.get(id) {
            // 删除 SSOT 目录
            let ssot_dir = get_ssot_dir()?;
            let ssot_path = ssot_dir.join(&row.directory);
            if ssot_path.exists() {
                if ssot_path.is_dir() {
                    fs::remove_dir_all(&ssot_path).map_err(|e| e.to_string())?;
                } else {
                    fs::remove_file(&ssot_path).map_err(|e| e.to_string())?;
                }
            }
            // 从应用目录删除
            for app in ["claude", "codex", "gemini"] {
                remove_from_app_dir(&row.directory, app);
            }
        }
        db.delete_skill(id)?;
        Ok(())
    }

    /// 切换 Skill 的应用启用状态
    pub fn toggle_app(
        db: &Arc<Database>,
        id: &str,
        app: &str,
        enabled: bool,
    ) -> Result<(), String> {
        let mut skills = db.get_all_installed_skills()?;
        let row = skills
            .get_mut(id)
            .ok_or_else(|| format!("Skill '{}' 不存在", id))?;

        match app {
            "claude" => row.enabled_claude = enabled,
            "codex" => row.enabled_codex = enabled,
            "gemini" => row.enabled_gemini = enabled,
            _ => return Err(format!("不支持的 app: {}", app)),
        }

        db.save_skill(row)?;

        if enabled {
            sync_to_app_dir(&row.directory, app)?;
        } else {
            remove_from_app_dir(&row.directory, app);
        }

        Ok(())
    }

    fn app_enabled(row: &InstalledSkillRow, app: &str) -> bool {
        match app {
            "claude" => row.enabled_claude,
            "codex" => row.enabled_codex,
            "gemini" => row.enabled_gemini,
            _ => false,
        }
    }

    // ========== 仓库管理 ==========

    pub fn get_repos(db: &Arc<Database>) -> Result<Vec<SkillRepo>, String> {
        db.get_skill_repos()
    }

    pub fn save_repo(db: &Arc<Database>, repo: SkillRepo) -> Result<(), String> {
        db.save_skill_repo(&repo)
    }

    pub fn delete_repo(db: &Arc<Database>, owner: &str, name: &str) -> Result<(), String> {
        db.delete_skill_repo(owner, name)
    }

    // ========== 发现功能 ==========

    pub async fn discover(db: &Arc<Database>) -> Result<Vec<DiscoverableSkill>, String> {
        let repos = db.get_skill_repos()?;
        let skills = discover_available(repos).await;
        Ok(skills)
    }
}
