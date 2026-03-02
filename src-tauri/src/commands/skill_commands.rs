use crate::database::dao::skills::{InstalledSkillRow, SkillRepo};
use crate::services::skill_discovery::DiscoverableSkill;
use crate::services::skill_service_v2::SkillServiceV2;
use crate::store::AppState;
use tauri::State;

/// 获取所有已安装的 Skills（数据库版）
#[tauri::command]
pub fn get_installed_skills(
    state: State<'_, AppState>,
) -> Result<Vec<InstalledSkillRow>, String> {
    SkillServiceV2::get_all_installed(&state.db)
}

/// 安装 Skill（从 GitHub 仓库下载）
#[tauri::command]
pub async fn install_skill(
    state: State<'_, AppState>,
    skill: DiscoverableSkill,
    current_app: String,
) -> Result<InstalledSkillRow, String> {
    SkillServiceV2::install(&state.db, &skill, &current_app).await
}

/// 卸载 Skill
#[tauri::command]
pub fn uninstall_skill(state: State<'_, AppState>, id: String) -> Result<(), String> {
    SkillServiceV2::uninstall(&state.db, &id)
}

/// 切换 Skill 的应用启用状态
#[tauri::command]
pub fn toggle_skill_app(
    state: State<'_, AppState>,
    id: String,
    app: String,
    enabled: bool,
) -> Result<(), String> {
    SkillServiceV2::toggle_app(&state.db, &id, &app, enabled)
}

/// 发现可安装的 Skills（从仓库抓取）
#[tauri::command]
pub async fn discover_skills(
    state: State<'_, AppState>,
) -> Result<Vec<DiscoverableSkill>, String> {
    SkillServiceV2::discover(&state.db).await
}

/// 获取技能仓库列表
#[tauri::command]
pub fn get_skill_repos(state: State<'_, AppState>) -> Result<Vec<SkillRepo>, String> {
    SkillServiceV2::get_repos(&state.db)
}

/// 保存技能仓库
#[tauri::command]
pub fn save_skill_repo(state: State<'_, AppState>, repo: SkillRepo) -> Result<(), String> {
    SkillServiceV2::save_repo(&state.db, repo)
}

/// 删除技能仓库
#[tauri::command]
pub fn delete_skill_repo(
    state: State<'_, AppState>,
    owner: String,
    name: String,
) -> Result<(), String> {
    SkillServiceV2::delete_repo(&state.db, &owner, &name)
}
