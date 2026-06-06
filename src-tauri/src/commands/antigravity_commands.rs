//! Antigravity 账号管理 Tauri 命令层。
//!
//! 所有命令以 `ag_` 前缀注册，对应前端的 `invoke('ag_*')` 调用。

use crate::models::antigravity::{AntigravityAccount, AntigravityQuotaData, RefreshStats};
use crate::services::antigravity_service::{ImportResult, WarmupResult};
use crate::store::AppState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn ag_list_accounts(
    state: State<'_, AppState>,
) -> Result<Vec<AntigravityAccount>, String> {
    crate::services::antigravity_service::list_accounts(&state.db)
}

#[tauri::command]
pub async fn ag_get_account(
    id: String,
    state: State<'_, AppState>,
) -> Result<AntigravityAccount, String> {
    crate::services::antigravity_service::get_account(&state.db, &id)
}

#[tauri::command]
pub async fn ag_add_account(
    email: String,
    refresh_token: String,
    state: State<'_, AppState>,
) -> Result<AntigravityAccount, String> {
    crate::services::antigravity_service::add_account(&state.db, &email, &refresh_token).await
}

#[tauri::command]
pub async fn ag_delete_account(id: String, state: State<'_, AppState>) -> Result<(), String> {
    crate::services::antigravity_service::delete_account(&state.db, &id)
}

#[tauri::command]
pub async fn ag_refresh_token(
    id: String,
    state: State<'_, AppState>,
) -> Result<AntigravityAccount, String> {
    crate::services::antigravity_service::refresh_account_token(&state.db, &id).await
}

#[tauri::command]
pub async fn ag_fetch_quota(
    id: String,
    state: State<'_, AppState>,
) -> Result<AntigravityQuotaData, String> {
    crate::services::antigravity_service::fetch_account_quota(&state.db, &id).await
}

#[tauri::command]
pub async fn ag_refresh_all_quotas(
    state: State<'_, AppState>,
) -> Result<RefreshStats, String> {
    crate::services::antigravity_service::refresh_all_quotas(&state.db).await
}

#[tauri::command]
pub async fn ag_switch_account(
    id: String,
    target_ide: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    crate::services::antigravity_service::switch_account(
        &state.db,
        &id,
        target_ide.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn ag_update_label(
    id: String,
    label: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    crate::services::antigravity_service::update_account_label(&state.db, &id, label)
}

#[tauri::command]
pub async fn ag_oauth_login(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AntigravityAccount, String> {
    crate::services::antigravity_service::start_oauth_login(&state.db, Some(app)).await
}

#[tauri::command]
pub async fn ag_reorder_accounts(
    ordered_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    crate::services::antigravity_service::reorder_accounts(&state.db, &ordered_ids)
}

#[tauri::command]
pub async fn ag_toggle_account(
    id: String,
    enable: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    crate::services::antigravity_service::toggle_account(&state.db, &id, enable)
}

#[tauri::command]
pub async fn ag_batch_delete_accounts(
    ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    crate::services::antigravity_service::batch_delete_accounts(&state.db, &ids)
}

#[tauri::command]
pub async fn ag_move_account(
    id: String,
    direction: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    crate::services::antigravity_service::move_account(&state.db, &id, &direction)
}

#[tauri::command]
pub async fn ag_export_accounts(
    ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<(String, String)>, String> {
    crate::services::antigravity_service::export_accounts(&state.db, &ids)
}

#[tauri::command]
pub async fn ag_import_from_manager(
    state: State<'_, AppState>,
) -> Result<ImportResult, String> {
    crate::services::antigravity_service::import_from_antigravity_manager(&state.db)
}

#[tauri::command]
pub async fn ag_warmup_account(
    id: String,
    state: State<'_, AppState>,
) -> Result<WarmupResult, String> {
    crate::services::antigravity_service::warmup_account(&state.db, &id).await
}

#[tauri::command]
pub async fn ag_warmup_all_accounts(
    state: State<'_, AppState>,
) -> Result<Vec<WarmupResult>, String> {
    crate::services::antigravity_service::warmup_all_accounts(&state.db).await
}

#[tauri::command]
pub async fn ag_get_operation_logs(
    account_id: String,
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::antigravity::AgOperationLog>, String> {
    let limit = limit.unwrap_or(50);
    crate::services::antigravity_service::get_operation_logs(&state.db, &account_id, limit)
}

#[tauri::command]
pub async fn ag_get_all_operation_logs(
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::antigravity::AgOperationLog>, String> {
    let limit = limit.unwrap_or(50);
    crate::services::antigravity_service::get_all_operation_logs(&state.db, limit)
}

#[tauri::command]
pub async fn ag_get_token_status(
    id: String,
    state: State<'_, AppState>,
) -> Result<crate::models::antigravity::TokenStatus, String> {
    crate::services::antigravity_service::get_token_status(&state.db, &id)
}
