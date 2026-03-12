use crate::deeplink::{self, DeepLinkImportRequest};
use crate::store::AppState;
use tauri::State;

#[tauri::command]
pub fn parse_deeplink(url: String) -> Result<DeepLinkImportRequest, String> {
    deeplink::parse_deeplink_url(&url).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_provider_from_deeplink(
    request: DeepLinkImportRequest,
    state: State<AppState>,
) -> Result<String, String> {
    deeplink::import_provider_from_deeplink(&state.db, &request)
        .map_err(|e| e.to_string())
}
