use crate::services::global_proxy_service::GlobalProxyConfig;
use crate::services::{
    env_checker_service, global_proxy_service, import_export_service, model_api_service,
    stream_check_service,
};
use crate::store::AppState;
use tauri::State;

#[tauri::command]
pub fn export_config(state: State<AppState>) -> Result<serde_json::Value, String> {
    import_export_service::export_all_config(&state.db)
}

#[tauri::command]
pub fn import_config(
    data: serde_json::Value,
    state: State<AppState>,
) -> Result<Vec<String>, String> {
    import_export_service::import_config(&state.db, data)
}

#[tauri::command]
pub fn export_providers_config(state: State<AppState>) -> Result<serde_json::Value, String> {
    import_export_service::export_providers_config(&state.db)
}

#[tauri::command]
pub fn import_providers_config(
    data: serde_json::Value,
    state: State<AppState>,
) -> Result<Vec<String>, String> {
    import_export_service::import_providers_config(&state.db, data)
}

#[tauri::command]
pub async fn check_stream_connectivity(
    url: String,
    api_key: String,
    model: String,
    app_type: Option<String>,
) -> Result<stream_check_service::StreamCheckResult, String> {
    stream_check_service::check_stream(url, api_key, model, app_type, None)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_global_proxy(
    state: tauri::State<crate::store::AppState>,
) -> Result<GlobalProxyConfig, String> {
    global_proxy_service::get_global_proxy_from_db(&state.db)
}

#[tauri::command]
pub fn set_global_proxy(
    config: GlobalProxyConfig,
    state: tauri::State<crate::store::AppState>,
) -> Result<(), String> {
    global_proxy_service::set_global_proxy_to_db(&state.db, &config)
}

#[tauri::command]
pub fn check_env() -> Result<Vec<env_checker_service::EnvIssue>, String> {
    env_checker_service::check_env_conflicts().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_models(url: String, api_key: String) -> Result<Vec<String>, String> {
    model_api_service::fetch_models(url, api_key)
        .await
        .map_err(|e| e.to_string())
}
