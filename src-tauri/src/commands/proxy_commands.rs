use crate::models::proxy::ProxyConfig;
use crate::proxy::types::ProxyState;
use crate::services::proxy_service;

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
