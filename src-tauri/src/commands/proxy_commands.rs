use crate::models::proxy::ProxyConfig;
use crate::proxy::types::ProxyState;
use crate::services::proxy_service;
use tauri::State;
use crate::store::AppState;

#[tauri::command]
pub fn get_proxy_config(state: State<AppState>) -> Result<ProxyConfig, String> {
    proxy_service::load_proxy_config_from_db(&state.db)
}

#[tauri::command]
pub fn save_proxy_config(config: ProxyConfig, state: State<AppState>) -> Result<(), String> {
    proxy_service::save_proxy_config_to_db(&state.db, &config)
}

#[tauri::command]
pub async fn start_proxy(config: ProxyConfig) -> Result<ProxyState, String> {
    proxy_service::start_proxy(config).await
}

#[tauri::command]
pub async fn stop_proxy() -> Result<(), String> {
    proxy_service::stop_proxy().await
}

#[tauri::command]
pub fn get_proxy_status() -> Result<ProxyState, String> {
    proxy_service::get_proxy_status()
}
