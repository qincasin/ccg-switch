use crate::database::dao::prompts::PromptRow;
use crate::services::prompt_service_v2::PromptServiceV2;
use crate::store::AppState;
use tauri::State;

/// 获取指定应用的所有 prompts
#[tauri::command]
pub fn get_prompts_v2(state: State<'_, AppState>, app_type: String) -> Result<Vec<PromptRow>, String> {
    PromptServiceV2::get_prompts(&state.db, &app_type)
}

/// 新增或更新 prompt
#[tauri::command]
pub fn upsert_prompt_v2(state: State<'_, AppState>, prompt: PromptRow) -> Result<(), String> {
    PromptServiceV2::upsert_prompt(&state.db, prompt)
}

/// 删除 prompt
#[tauri::command]
pub fn delete_prompt_v2(state: State<'_, AppState>, id: String, app_type: String) -> Result<(), String> {
    PromptServiceV2::delete_prompt(&state.db, &id, &app_type)
}

/// 启用 prompt
#[tauri::command]
pub fn enable_prompt_v2(state: State<'_, AppState>, id: String, app_type: String) -> Result<(), String> {
    PromptServiceV2::enable_prompt(&state.db, &id, &app_type)
}

/// 禁用 prompt
#[tauri::command]
pub fn disable_prompt_v2(state: State<'_, AppState>, id: String, app_type: String) -> Result<(), String> {
    PromptServiceV2::disable_prompt(&state.db, &id, &app_type)
}

/// 从 live 文件导入 prompt
#[tauri::command]
pub fn import_prompt_from_file(state: State<'_, AppState>, app_type: String) -> Result<String, String> {
    PromptServiceV2::import_from_file(&state.db, &app_type)
}

/// 获取 live 文件内容
#[tauri::command]
pub fn get_prompt_live_content(app_type: String) -> Result<Option<String>, String> {
    PromptServiceV2::get_live_content(&app_type)
}
