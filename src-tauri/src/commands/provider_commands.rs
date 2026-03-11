use crate::models::app_type::AppType;
use crate::models::provider::Provider;
use crate::services::provider_service;
use crate::services::stream_check_service;
use tauri::State;
use crate::store::AppState;

#[tauri::command]
pub fn get_providers(app: String, state: State<AppState>) -> Result<Vec<Provider>, String> {
    let app_type: AppType = app.parse().map_err(|e: String| e)?;
    provider_service::list_providers_from_db(&state.db, app_type)
}

#[tauri::command]
pub fn get_all_providers(state: State<AppState>) -> Result<Vec<Provider>, String> {
    provider_service::list_all_providers_from_db(&state.db)
}

#[tauri::command]
pub fn add_provider(provider: Provider, state: State<AppState>) -> Result<(), String> {
    provider_service::add_provider_to_db(&state.db, provider)
}

#[tauri::command]
pub fn update_provider(provider_id: String, provider: Provider, state: State<AppState>) -> Result<(), String> {
    provider_service::update_provider_in_db(&state.db, &provider_id, provider)
}

#[tauri::command]
pub fn delete_provider(provider_id: String, state: State<AppState>) -> Result<(), String> {
    provider_service::delete_provider_from_db(&state.db, &provider_id)
}

#[tauri::command]
pub fn switch_provider(app: String, provider_id: String, state: State<AppState>) -> Result<(), String> {
    let app_type: AppType = app.parse().map_err(|e: String| e)?;
    provider_service::switch_provider_in_db(&state.db, app_type, &provider_id)
}

#[tauri::command]
pub fn move_provider(provider_id: String, target_index: usize, state: State<AppState>) -> Result<(), String> {
    provider_service::move_provider_in_db(&state.db, &provider_id, target_index)
}

#[tauri::command]
pub fn get_provider_config_files(app: String) -> Result<Vec<(String, String)>, String> {
    let app_type: AppType = app.parse().map_err(|e: String| e)?;
    provider_service::get_provider_config_files(app_type).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn preview_provider_sync(provider: Provider) -> Result<Vec<(String, String, String)>, String> {
    provider_service::preview_provider_sync(&provider).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_claude_settings_state() -> Result<serde_json::Value, String> {
    provider_service::get_claude_settings_state().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_provider_health(
    provider_id: String,
    state: State<'_, AppState>,
) -> Result<stream_check_service::ProviderHealthResult, String> {
    stream_check_service::check_provider_health(provider_id, &state.db)
        .await
        .map_err(|e| e.to_string())
}
