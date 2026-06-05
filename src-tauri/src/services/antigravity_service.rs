use crate::database::Database;
use crate::models::antigravity::{
    AgOperationLog, AntigravityAccount, AntigravityModelQuota, AntigravityQuotaData, RefreshStats,
    TokenResponse, TokenStatus, UserInfo,
};
use serde::Deserialize;
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::mpsc;

const CLIENT_ID: &str =
    "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const CLIENT_SECRET: &str = "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";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const USERINFO_URL: &str = "https://www.googleapis.com/oauth2/v2/userinfo";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const PROJECT_URL: &str =
    "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:loadCodeAssist";
const QUOTA_ENDPOINTS: [&str; 3] = [
    "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels",
    "https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
    "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
];
const WARMUP_MODELS_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models";

// Quota protection thresholds
const QUOTA_WARNING_THRESHOLD: i32 = 10; // percentage
const QUOTA_EXHAUSTED_THRESHOLD: i32 = 5; // percentage

pub async fn refresh_access_token(refresh_token: &str) -> Result<TokenResponse, String> {
    let client = reqwest::Client::new();
    let params = [
        ("client_id", CLIENT_ID),
        ("client_secret", CLIENT_SECRET),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ];

    let response = client
        .post(TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Refresh request failed: {}", e))?;

    if response.status().is_success() {
        response
            .json::<TokenResponse>()
            .await
            .map_err(|e| format!("Refresh data parsing failed: {}", e))
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Refresh failed ({}): {}", status, error_text))
    }
}

pub async fn get_user_info(access_token: &str) -> Result<UserInfo, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(USERINFO_URL)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("User info request failed: {}", e))?;

    if response.status().is_success() {
        response
            .json::<UserInfo>()
            .await
            .map_err(|e| format!("User info parsing failed: {}", e))
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Failed to get user info: {}", error_text))
    }
}

async fn fetch_project_id(access_token: &str) -> Option<String> {
    let client = reqwest::Client::new();
    let meta = json!({"metadata": {"ideType": "ANTIGRAVITY"}});

    let res = client
        .post(PROJECT_URL)
        .header("Authorization", format!("Bearer {}", access_token))
        .json(&meta)
        .send()
        .await
        .ok()?;

    if res.status().is_success() {
        let data: serde_json::Value = res.json().await.ok()?;
        data.get("cloudaicompanionProject")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    } else {
        None
    }
}

#[derive(serde::Deserialize)]
struct QuotaResponse {
    #[serde(default)]
    models: std::collections::HashMap<String, ModelInfo>,
}

#[derive(serde::Deserialize)]
struct ModelInfo {
    #[serde(rename = "quotaInfo")]
    quota_info: Option<QuotaInfo>,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(rename = "supportsImages")]
    supports_images: Option<bool>,
    #[serde(rename = "supportsThinking")]
    supports_thinking: Option<bool>,
    #[serde(rename = "thinkingBudget")]
    thinking_budget: Option<i32>,
    recommended: Option<bool>,
    #[serde(rename = "maxTokens")]
    max_tokens: Option<i32>,
    #[serde(rename = "maxOutputTokens")]
    max_output_tokens: Option<i32>,
}

#[derive(serde::Deserialize)]
struct QuotaInfo {
    #[serde(rename = "remainingFraction")]
    remaining_fraction: Option<f64>,
    #[serde(rename = "resetTime")]
    reset_time: Option<String>,
}

pub async fn fetch_quota(
    access_token: &str,
    project_id: Option<&str>,
) -> Result<AntigravityQuotaData, String> {
    let client = reqwest::Client::new();
    let payload = if let Some(pid) = project_id {
        json!({ "project": pid })
    } else {
        json!({})
    };

    let mut last_error = None;

    for ep_url in &QUOTA_ENDPOINTS {
        match client
            .post(*ep_url)
            .bearer_auth(access_token)
            .json(&payload)
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    let quota_response: QuotaResponse = response
                        .json()
                        .await
                        .map_err(|e| format!("Quota parse failed: {}", e))?;

                    let mut models = Vec::new();
                    for (name, info) in quota_response.models {
                        if let Some(qi) = info.quota_info {
                            let percentage =
                                qi.remaining_fraction.map(|f| (f * 100.0) as i32).unwrap_or(0);
                            if name.starts_with("gemini")
                                || name.starts_with("claude")
                                || name.starts_with("gpt")
                            {
                                models.push(AntigravityModelQuota {
                                    name,
                                    percentage,
                                    reset_time: qi.reset_time.unwrap_or_default(),
                                    display_name: info.display_name,
                                    supports_images: info.supports_images,
                                    supports_thinking: info.supports_thinking,
                                    thinking_budget: info.thinking_budget,
                                    recommended: info.recommended,
                                    max_tokens: info.max_tokens,
                                    max_output_tokens: info.max_output_tokens,
                                });
                            }
                        }
                    }

                    models.sort_by(|a, b| a.name.cmp(&b.name));

                    return Ok(AntigravityQuotaData {
                        models,
                        last_updated: chrono::Utc::now().timestamp(),
                        is_forbidden: false,
                        forbidden_reason: None,
                        subscription_tier: None,
                    });
                }

                if response.status() == reqwest::StatusCode::FORBIDDEN {
                    return Ok(AntigravityQuotaData {
                        models: Vec::new(),
                        last_updated: chrono::Utc::now().timestamp(),
                        is_forbidden: true,
                        forbidden_reason: Some("403 Forbidden".to_string()),
                        subscription_tier: None,
                    });
                }

                last_error = Some(format!("HTTP {}", response.status()));
            }
            Err(e) => {
                last_error = Some(e.to_string());
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "All quota endpoints failed".to_string()))
}

/// Check quota protection for an account after quota refresh.
///
/// - If ANY model's percentage is <= QUOTA_WARNING_THRESHOLD, logs a warning
/// - If ALL models' percentages are <= QUOTA_EXHAUSTED_THRESHOLD, disables the account
///
/// Returns `true` if protection was triggered (either warning or disable).
pub fn check_quota_protection(
    db: &Arc<Database>,
    account_id: &str,
    quota: &AntigravityQuotaData,
) -> Result<bool, String> {
    if quota.models.is_empty() {
        return Ok(false);
    }

    let any_low = quota
        .models
        .iter()
        .any(|m| m.percentage <= QUOTA_WARNING_THRESHOLD);

    let all_exhausted = quota
        .models
        .iter()
        .all(|m| m.percentage <= QUOTA_EXHAUSTED_THRESHOLD);

    if all_exhausted {
        let low_models: Vec<String> = quota
            .models
            .iter()
            .map(|m| format!("{} ({}%)", m.name, m.percentage))
            .collect();
        tracing::warn!(
            "Quota protection: disabling account {}, all models exhausted: [{}]",
            account_id,
            low_models.join(", ")
        );

        let mut account = db
            .get_antigravity_account(account_id)?
            .ok_or_else(|| format!("Account not found: {}", account_id))?;
        account.disabled = true;
        account.disabled_reason = Some("Quota protection: all models exhausted".to_string());
        db.upsert_antigravity_account(&account)?;
        return Ok(true);
    }

    if any_low {
        let low_models: Vec<String> = quota
            .models
            .iter()
            .filter(|m| m.percentage <= QUOTA_WARNING_THRESHOLD)
            .map(|m| format!("{} ({}%)", m.name, m.percentage))
            .collect();
        tracing::warn!(
            "Quota protection: low quota warning for account {}, models: [{}]",
            account_id,
            low_models.join(", ")
        );
        return Ok(true);
    }

    Ok(false)
}

pub fn list_accounts(db: &Arc<Database>) -> Result<Vec<AntigravityAccount>, String> {
    db.list_antigravity_accounts()
}

pub fn get_account(db: &Arc<Database>, id: &str) -> Result<AntigravityAccount, String> {
    db.get_antigravity_account(id)?
        .ok_or_else(|| format!("Account not found: {}", id))
}

pub async fn add_account(
    db: &Arc<Database>,
    email: &str,
    refresh_token: &str,
) -> Result<AntigravityAccount, String> {
    if let Some(existing) = db.find_antigravity_account_by_email(email)? {
        return Err(format!("Account already exists: {}", existing.email));
    }

    let token_res = refresh_access_token(refresh_token).await?;
    let user_info = get_user_info(&token_res.access_token).await?;

    if user_info.email.to_lowercase() != email.to_lowercase() {
        return Err(format!(
            "Email mismatch: expected {}, got {}",
            email, user_info.email
        ));
    }

    let project_id = fetch_project_id(&token_res.access_token).await;
    let now = chrono::Utc::now().timestamp();
    let display_name = user_info.get_display_name();
    let email = user_info.email;

    let mut account = AntigravityAccount {
        id: uuid::Uuid::new_v4().to_string(),
        email,
        name: display_name,
        access_token: token_res.access_token,
        refresh_token: refresh_token.to_string(),
        expires_in: token_res.expires_in,
        expiry_timestamp: now + token_res.expires_in,
        oauth_client_key: None,
        project_id,
        subscription_tier: None,
        custom_label: None,
        is_active: false,
        disabled: false,
        disabled_reason: None,
        quota: None,
        device_profile: None,
        created_at: now,
        last_used: now,
        order_index: db.get_next_antigravity_order_index()?,
    };

    match fetch_quota(&account.access_token, account.project_id.as_deref()).await {
        Ok(quota) => {
            account.subscription_tier = quota.subscription_tier.clone();
            account.quota = Some(quota);
        }
        Err(e) => {
            tracing::warn!("Failed to fetch initial quota for {}: {}", account.email, e);
        }
    }

    let existing = db.list_antigravity_accounts()?;
    if existing.is_empty() {
        account.is_active = true;
    }

    db.upsert_antigravity_account(&account)?;
    if let Err(e) = db.log_ag_operation(&account.id, &account.email, "account_added", None) {
        tracing::warn!("Failed to log account_added operation: {}", e);
    }
    Ok(account)
}

pub fn delete_account(db: &Arc<Database>, id: &str) -> Result<(), String> {
    let account = db
        .get_antigravity_account(id)?
        .ok_or_else(|| format!("Account not found: {}", id))?;

    if account.is_active {
        let all = db.list_antigravity_accounts()?;
        if let Some(next) = all.iter().find(|a| a.id != id) {
            db.set_active_antigravity_account(&next.id)?;
        }
    }

    if let Err(e) = db.log_ag_operation(&account.id, &account.email, "account_deleted", None) {
        tracing::warn!("Failed to log account_deleted operation: {}", e);
    }
    db.delete_antigravity_account(id)?;
    Ok(())
}

pub async fn refresh_account_token(
    db: &Arc<Database>,
    id: &str,
) -> Result<AntigravityAccount, String> {
    let mut account = get_account(db, id)?;

    let token_res = refresh_access_token(&account.refresh_token).await?;
    let now = chrono::Utc::now().timestamp();

    account.access_token = token_res.access_token;
    account.expires_in = token_res.expires_in;
    account.expiry_timestamp = now + token_res.expires_in;
    account.last_used = now;

    if account.disabled {
        if let Some(ref reason) = account.disabled_reason {
            if reason.contains("Token refresh failed") || reason.contains("Quota protection") {
                account.disabled = false;
                account.disabled_reason = None;
            }
        }
    }

    if let Ok(user_info) = get_user_info(&account.access_token).await {
        account.name = user_info.get_display_name().or(account.name);
    }

    db.upsert_antigravity_account(&account)?;
    if let Err(e) = db.log_ag_operation(&account.id, &account.email, "token_refresh", None) {
        tracing::warn!("Failed to log token_refresh operation: {}", e);
    }
    Ok(account)
}

pub async fn fetch_account_quota(
    db: &Arc<Database>,
    id: &str,
) -> Result<AntigravityQuotaData, String> {
    let mut account = get_account(db, id)?;

    if account.is_token_expired() {
        account = refresh_account_token(db, id).await?;
    }

    let quota = fetch_quota(&account.access_token, account.project_id.as_deref()).await?;

    // Save updated quota back to account
    let mut account = get_account(db, id)?;
    account.quota = Some(quota.clone());
    account.last_used = chrono::Utc::now().timestamp();
    db.upsert_antigravity_account(&account)?;
    if let Err(e) = db.log_ag_operation(&account.id, &account.email, "quota_refresh", None) {
        tracing::warn!("Failed to log quota_refresh operation: {}", e);
    }

    // Check quota protection after refresh
    if let Err(e) = check_quota_protection(db, id, &quota) {
        tracing::warn!("Quota protection check failed for {}: {}", account.email, e);
    }

    Ok(quota)
}

pub async fn refresh_all_quotas(db: &Arc<Database>) -> Result<RefreshStats, String> {
    let accounts = db.list_antigravity_accounts()?;
    let total = accounts.len();
    let mut success = 0;
    let mut failed = 0;
    let mut details = Vec::new();

    for mut account in accounts {
        if account.is_token_expired() {
            match refresh_access_token(&account.refresh_token).await {
                Ok(token_res) => {
                    let now = chrono::Utc::now().timestamp();
                    account.access_token = token_res.access_token;
                    account.expires_in = token_res.expires_in;
                    account.expiry_timestamp = now + token_res.expires_in;
                    if account.disabled {
                        account.disabled = false;
                        account.disabled_reason = None;
                    }
                }
                Err(e) => {
                    account.disabled = true;
                    account.disabled_reason = Some(format!("Token refresh failed: {}", e));
                    let _ = db.upsert_antigravity_account(&account);
                    failed += 1;
                    details.push(format!("{}: Token refresh failed", account.email));
                    continue;
                }
            }
        }

        match fetch_quota(&account.access_token, account.project_id.as_deref()).await {
            Ok(quota) => {
                account.subscription_tier = quota
                    .subscription_tier
                    .clone()
                    .or(account.subscription_tier);
                account.quota = Some(quota.clone());
                account.last_used = chrono::Utc::now().timestamp();
                db.upsert_antigravity_account(&account)?;

                // Check quota protection after refresh
                if let Err(e) = check_quota_protection(db, &account.id, &quota) {
                    tracing::warn!(
                        "Quota protection check failed for {}: {}",
                        account.email,
                        e
                    );
                }

                success += 1;
            }
            Err(e) => {
                failed += 1;
                details.push(format!("{}: {}", account.email, e));
            }
        }
    }

    Ok(RefreshStats {
        total,
        success,
        failed,
        details,
    })
}

pub async fn switch_account(
    db: &Arc<Database>,
    id: &str,
    target_ide: Option<&str>,
) -> Result<(), String> {
    let mut account = get_account(db, id)?;

    // 1. Ensure token is fresh before switching
    if account.is_token_expired() {
        tracing::info!("Token expired, refreshing before switch...");
        account = refresh_account_token(db, id).await?;
    }

    db.set_active_antigravity_account(id)?;

    // 2. Execute local app switch: close → inject credentials → restart
    let switch_data = crate::services::ag_integration::SwitchAccountData {
        email: account.email.clone(),
        access_token: account.access_token.clone(),
        refresh_token: account.refresh_token.clone(),
        expiry_timestamp: account.expiry_timestamp,
    };

    let ide = target_ide.map(|s| s.to_string());
    tokio::task::spawn_blocking(move || {
        crate::services::ag_integration::execute_local_switch(&switch_data, ide.as_deref())
    })
    .await
    .map_err(|e| format!("Switch task panicked: {}", e))??;

    // 3. Update Antigravity Manager's accounts.json if it exists
    update_antigravity_manager_current_account(&account.email);

    // 4. Copy refresh_token to system clipboard
    if let Err(e) = copy_refresh_token_to_clipboard(&account.refresh_token) {
        tracing::warn!("Failed to copy refresh token to clipboard: {}", e);
    }

    if let Err(e) = db.log_ag_operation(
        &account.id,
        &account.email,
        "account_switch",
        target_ide,
    ) {
        tracing::warn!("Failed to log account_switch operation: {}", e);
    }

    Ok(())
}

/// Update the `current_account_id` in ~/.antigravity_tools/accounts.json
/// so the Antigravity app picks up the account switch.
/// Silently continues if the file doesn't exist or the email isn't found.
fn update_antigravity_manager_current_account(email: &str) {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return,
    };
    let accounts_path = home.join(".antigravity_tools").join("accounts.json");

    if !accounts_path.exists() {
        return;
    }

    // Read the file
    let content = match std::fs::read_to_string(&accounts_path) {
        Ok(c) => c,
        Err(e) => {
            tracing::debug!("Could not read accounts.json: {}", e);
            return;
        }
    };

    // Parse as generic JSON to preserve unknown fields
    let mut accounts_data: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => {
            tracing::debug!("Could not parse accounts.json: {}", e);
            return;
        }
    };

    // Find the account entry matching the email
    let accounts_array = match accounts_data.get_mut("accounts").and_then(|v| v.as_array_mut()) {
        Some(arr) => arr,
        None => return,
    };

    let matched_id = accounts_array.iter().find_map(|entry| {
        if entry.get("email").and_then(|e| e.as_str()) == Some(email) {
            entry.get("id").and_then(|id| id.as_str()).map(|s| s.to_string())
        } else {
            None
        }
    });

    if let Some(ref matched_id) = matched_id {
        accounts_data["current_account_id"] = serde_json::Value::String(matched_id.clone());

        // Write back atomically: write to temp file then rename
        let temp_path = accounts_path.with_extension("json.tmp");
        let json_bytes = match serde_json::to_string_pretty(&accounts_data) {
            Ok(s) => s.into_bytes(),
            Err(e) => {
                tracing::debug!("Could not serialize accounts.json: {}", e);
                return;
            }
        };

        if let Err(e) = std::fs::write(&temp_path, &json_bytes) {
            tracing::debug!("Could not write temp accounts.json: {}", e);
            return;
        }

        if let Err(e) = std::fs::rename(&temp_path, &accounts_path) {
            tracing::debug!("Could not rename temp accounts.json: {}", e);
            let _ = std::fs::remove_file(&temp_path);
        }
    }
    // If email not found in accounts.json, silently continue
}

/// Copy the refresh token to the system clipboard using arboard.
fn copy_refresh_token_to_clipboard(refresh_token: &str) -> Result<(), String> {
    let mut ctx = arboard::Clipboard::new().map_err(|e| format!("Clipboard init failed: {}", e))?;
    ctx.set_text(refresh_token)
        .map_err(|e| format!("Clipboard write failed: {}", e))
}

pub fn update_account_label(
    db: &Arc<Database>,
    id: &str,
    label: Option<String>,
) -> Result<(), String> {
    let mut account = get_account(db, id)?;
    account.custom_label = label;
    db.upsert_antigravity_account(&account)?;
    Ok(())
}

pub fn reorder_accounts(
    db: &Arc<Database>,
    ordered_ids: &[String],
) -> Result<(), String> {
    let accounts = db.list_antigravity_accounts()?;
    let mut reordered = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for (idx, id) in ordered_ids.iter().enumerate() {
        if let Some(mut acc) = accounts.iter().find(|a| &a.id == id).cloned() {
            acc.order_index = idx as i32;
            reordered.push(acc);
            seen.insert(id.clone());
        }
    }

    let mut offset = reordered.len() as i32;
    for mut acc in accounts {
        if !seen.contains(&acc.id) {
            acc.order_index = offset;
            reordered.push(acc);
            offset += 1;
        }
    }

    for acc in &reordered {
        db.upsert_antigravity_account(acc)?;
    }

    Ok(())
}

pub fn toggle_account(
    db: &Arc<Database>,
    id: &str,
    enable: bool,
) -> Result<(), String> {
    let mut account = get_account(db, id)?;
    account.disabled = !enable;
    if enable {
        account.disabled_reason = None;
    } else {
        account.disabled_reason = Some("Manually disabled".to_string());
    }
    db.upsert_antigravity_account(&account)?;

    // If we disabled the active account, switch to the first non-disabled one
    if !enable && account.is_active {
        let all = db.list_antigravity_accounts()?;
        if let Some(next) = all.iter().find(|a| a.id != id && !a.disabled) {
            db.set_active_antigravity_account(&next.id)?;
        }
    }

    if let Err(e) = db.log_ag_operation(
        &account.id,
        &account.email,
        "account_toggled",
        Some(if enable { "enabled" } else { "disabled" }),
    ) {
        tracing::warn!("Failed to log account_toggled operation: {}", e);
    }

    Ok(())
}

pub fn batch_delete_accounts(
    db: &Arc<Database>,
    ids: &[String],
) -> Result<usize, String> {
    let accounts = db.list_antigravity_accounts()?;
    let id_set: std::collections::HashSet<&String> = ids.iter().collect();

    // Find the active account among those being deleted
    let active_deleted = accounts
        .iter()
        .find(|a| a.is_active && id_set.contains(&a.id));

    let mut deleted = 0;
    for id in ids {
        if db.get_antigravity_account(id)?.is_some() {
            db.delete_antigravity_account(id)?;
            deleted += 1;
        }
    }

    // If the active account was deleted, switch to first remaining account
    if active_deleted.is_some() {
        let remaining = db.list_antigravity_accounts()?;
        if let Some(first) = remaining.first() {
            db.set_active_antigravity_account(&first.id)?;
        }
    }

    Ok(deleted)
}

pub fn move_account(
    db: &Arc<Database>,
    id: &str,
    direction: &str,
) -> Result<(), String> {
    let mut accounts = db.list_antigravity_accounts()?;
    accounts.sort_by_key(|a| a.order_index);

    let pos = accounts
        .iter()
        .position(|a| a.id == id)
        .ok_or_else(|| format!("Account not found: {}", id))?;

    match direction {
        "up" => {
            if pos == 0 {
                return Ok(());
            }
            accounts.swap(pos, pos - 1);
        }
        "down" => {
            if pos >= accounts.len() - 1 {
                return Ok(());
            }
            accounts.swap(pos, pos + 1);
        }
        "top" => {
            let item = accounts.remove(pos);
            accounts.insert(0, item);
        }
        "bottom" => {
            let item = accounts.remove(pos);
            accounts.push(item);
        }
        _ => return Err(format!("Invalid direction: {}", direction)),
    }

    // Reassign order indices
    for (idx, acc) in accounts.iter_mut().enumerate() {
        acc.order_index = idx as i32;
        db.upsert_antigravity_account(acc)?;
    }

    Ok(())
}

/// Warmup result returned by warmup operations
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WarmupResult {
    pub account_id: String,
    pub email: String,
    pub warmed_models: usize,
    pub total_models: usize,
    pub errors: Vec<String>,
}

/// Warmup an account by sending lightweight authenticated requests to the Google API
/// for models that are at 100% quota. This keeps the token active and "warms up" the
/// quota counter.
pub async fn warmup_account(
    db: &Arc<Database>,
    id: &str,
) -> Result<WarmupResult, String> {
    let mut account = get_account(db, id)?;

    // Ensure token is fresh
    if account.is_token_expired() {
        account = refresh_account_token(db, id).await?;
    }

    // Fetch current quota to find models at 100%
    let quota = fetch_quota(&account.access_token, account.project_id.as_deref()).await?;

    // Find models at 100% that need warming
    let models_to_warm: Vec<&AntigravityModelQuota> = quota
        .models
        .iter()
        .filter(|m| m.percentage == 100)
        .collect();

    let total_models = quota.models.len();
    let mut warmed = 0;
    let mut errors = Vec::new();

    let client = reqwest::Client::new();

    for model in &models_to_warm {
        // Send a lightweight authenticated GET request to keep the token active
        // and "warm up" the quota counter
        match client.get(WARMUP_MODELS_URL)
            .header("Authorization", format!("Bearer {}", account.access_token))
            .send().await {
            Ok(response) => {
                if response.status().is_success() {
                    tracing::info!("Warmup successful for model {}", model.name);
                    warmed += 1;
                } else {
                    let status = response.status();
                    let error_text = response.text().await.unwrap_or_default();
                    let msg = format!(
                        "Warmup failed for model {}: HTTP {} - {}",
                        model.name, status, error_text
                    );
                    tracing::warn!("{}", msg);
                    errors.push(msg);
                }
            }
            Err(e) => {
                let msg = format!("Warmup request failed for model {}: {}", model.name, e);
                tracing::warn!("{}", msg);
                errors.push(msg);
            }
        }
    }

    // Save updated quota back to account after warmup
    let mut account = get_account(db, id)?;
    account.quota = Some(quota);
    account.last_used = chrono::Utc::now().timestamp();
    db.upsert_antigravity_account(&account)?;

    tracing::info!(
        "Warmup complete for {}: {}/{} models warmed",
        account.email,
        warmed,
        total_models
    );

    Ok(WarmupResult {
        account_id: id.to_string(),
        email: account.email,
        warmed_models: warmed,
        total_models: total_models,
        errors,
    })
}

/// Warmup all non-disabled accounts
pub async fn warmup_all_accounts(
    db: &Arc<Database>,
) -> Result<Vec<WarmupResult>, String> {
    let accounts = db.list_antigravity_accounts()?;
    let mut results = Vec::new();

    for account in &accounts {
        // Skip disabled accounts
        if account.disabled {
            tracing::info!("Skipping warmup for disabled account {}", account.email);
            continue;
        }

        match warmup_account(db, &account.id).await {
            Ok(result) => results.push(result),
            Err(e) => {
                tracing::warn!("Warmup failed for {}: {}", account.email, e);
                results.push(WarmupResult {
                    account_id: account.id.clone(),
                    email: account.email.clone(),
                    warmed_models: 0,
                    total_models: 0,
                    errors: vec![e],
                });
            }
        }
    }

    Ok(results)
}

pub fn export_accounts(
    db: &Arc<Database>,
    ids: &[String],
) -> Result<Vec<(String, String)>, String> {
    let accounts = db.list_antigravity_accounts()?;
    Ok(accounts
        .into_iter()
        .filter(|a| ids.contains(&a.id))
        .map(|a| (a.email, a.refresh_token))
        .collect())
}

// ─── OAuth Browser Login ───

async fn exchange_code(code: &str, redirect_uri: &str) -> Result<TokenResponse, String> {
    let client = reqwest::Client::new();
    let params = [
        ("client_id", CLIENT_ID),
        ("client_secret", CLIENT_SECRET),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code"),
    ];

    let response = client
        .post(TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    if response.status().is_success() {
        response
            .json::<TokenResponse>()
            .await
            .map_err(|e| format!("Token parsing failed: {}", e))
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Token exchange failed: {}", error_text))
    }
}

const OAUTH_SUCCESS_HTML: &str = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n\
<html><body style='font-family:sans-serif;text-align:center;padding:50px'>\
<h1 style='color:green'>&#x2705; Authorization Successful!</h1>\
<p>You can close this window and return to the application.</p>\
<script>setTimeout(function(){window.close();},2000);</script>\
</body></html>";

const OAUTH_FAIL_HTML: &str = "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\n\r\n\
<html><body style='font-family:sans-serif;text-align:center;padding:50px'>\
<h1 style='color:red'>&#x274C; Authorization Failed</h1>\
<p>Please return to the app and try again.</p>\
</body></html>";

fn parse_callback_request(request: &str) -> (Option<String>, Option<String>) {
    request
        .lines()
        .next()
        .and_then(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            parts.get(1).copied()
        })
        .and_then(|path| url::Url::parse(&format!("http://localhost{}", path)).ok())
        .map(|url| {
            let mut code = None;
            let mut state = None;
            for (k, v) in url.query_pairs() {
                match k.as_ref() {
                    "code" => code = Some(v.to_string()),
                    "state" => state = Some(v.to_string()),
                    _ => {}
                }
            }
            (code, state)
        })
        .unwrap_or((None, None))
}

async fn handle_callback(stream: &mut tokio::net::TcpStream, expected_state: &str, tx: &mpsc::Sender<Result<String, String>>) {
    let mut buffer = [0u8; 4096];
    let bytes_read = stream.read(&mut buffer).await.unwrap_or(0);
    let request = String::from_utf8_lossy(&buffer[..bytes_read]);

    let (code, received_state) = parse_callback_request(&request);

    let (result, html) = match code {
        Some(code) if received_state.as_deref() == Some(expected_state) => {
            (Ok(code), OAUTH_SUCCESS_HTML)
        }
        Some(_) => (Err("OAuth state mismatch".to_string()), OAUTH_FAIL_HTML),
        None => (Err("No authorization code in callback".to_string()), OAUTH_FAIL_HTML),
    };

    let _ = stream.write_all(html.as_bytes()).await;
    let _ = stream.flush().await;
    let _ = tx.send(result).await;
}

pub async fn start_oauth_login(
    db: &Arc<Database>,
    app_handle: Option<tauri::AppHandle>,
) -> Result<AntigravityAccount, String> {
    // 1. Start local TCP listener on ephemeral port (IPv4 + IPv6)
    let port: u16;
    let mut ipv4_listener: Option<TcpListener> = None;
    let mut ipv6_listener: Option<TcpListener> = None;

    match TcpListener::bind("[::1]:0").await {
        Ok(l6) => {
            port = l6.local_addr().map_err(|e| format!("Get port failed: {}", e))?.port();
            ipv6_listener = Some(l6);
            if let Ok(l4) = TcpListener::bind(format!("127.0.0.1:{}", port)).await {
                ipv4_listener = Some(l4);
            }
        }
        Err(_) => {
            let l4 = TcpListener::bind("127.0.0.1:0")
                .await
                .map_err(|e| format!("Bind failed: {}", e))?;
            port = l4.local_addr().map_err(|e| format!("Get port failed: {}", e))?.port();
            ipv4_listener = Some(l4);
            if let Ok(l6) = TcpListener::bind(format!("[::1]:{}", port)).await {
                ipv6_listener = Some(l6);
            }
        }
    }

    let has_v4 = ipv4_listener.is_some();
    let has_v6 = ipv6_listener.is_some();
    let redirect_uri = if has_v4 && has_v6 {
        format!("http://localhost:{}/oauth-callback", port)
    } else if has_v4 {
        format!("http://127.0.0.1:{}/oauth-callback", port)
    } else {
        format!("http://[::1]:{}/oauth-callback", port)
    };

    let state_str = uuid::Uuid::new_v4().to_string();
    let scopes = [
        "openid",
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" ");

    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&state={}",
        AUTH_URL, CLIENT_ID,
        url::form_urlencoded::byte_serialize(redirect_uri.as_bytes()).collect::<String>(),
        url::form_urlencoded::byte_serialize(scopes.as_bytes()).collect::<String>(),
        state_str,
    );

    // 2. Channel for receiving the authorization code
    let (code_tx, mut code_rx) = mpsc::channel::<Result<String, String>>(2);

    // 3. Start TCP listeners
    if let Some(l4) = ipv4_listener {
        let tx = code_tx.clone();
        let expected = state_str.clone();
        tokio::spawn(async move {
            if let Ok((mut stream, _)) = l4.accept().await {
                handle_callback(&mut stream, &expected, &tx).await;
            }
        });
    }
    if let Some(l6) = ipv6_listener {
        let tx = code_tx;
        let expected = state_str.clone();
        tokio::spawn(async move {
            if let Ok((mut stream, _)) = l6.accept().await {
                handle_callback(&mut stream, &expected, &tx).await;
            }
        });
    }

    // 4. Open browser
    if let Some(h) = app_handle {
        use tauri_plugin_opener::OpenerExt;
        h.opener()
            .open_url(&auth_url, None::<String>)
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }

    // 5. Wait for callback
    let code = match code_rx.recv().await {
        Some(Ok(code)) => code,
        Some(Err(e)) => return Err(e),
        None => return Err("OAuth flow cancelled".to_string()),
    };

    // 6. Exchange code for token
    let token_res = exchange_code(&code, &redirect_uri).await?;
    let refresh_token = token_res.refresh_token
        .ok_or_else(|| "No refresh token returned. Please revoke access in Google Account and retry.".to_string())?;

    // 7. Get user info
    let user_info = get_user_info(&token_res.access_token).await?;
    let display_name = user_info.get_display_name();
    let email = user_info.email;

    // 8. Upsert account
    if let Some(existing) = db.find_antigravity_account_by_email(&email)? {
        let mut account = get_account(db, &existing.id)?;
        account.access_token = token_res.access_token;
        account.refresh_token = refresh_token;
        account.expires_in = token_res.expires_in;
        account.expiry_timestamp = chrono::Utc::now().timestamp() + token_res.expires_in;
        account.name = display_name.or(account.name);
        account.disabled = false;
        account.disabled_reason = None;
        db.upsert_antigravity_account(&account)?;
        return Ok(account);
    }

    // 9. Create new account
    let project_id = fetch_project_id(&token_res.access_token).await;
    let now = chrono::Utc::now().timestamp();

    let mut account = AntigravityAccount {
        id: uuid::Uuid::new_v4().to_string(),
        email,
        name: display_name,
        access_token: token_res.access_token,
        refresh_token,
        expires_in: token_res.expires_in,
        expiry_timestamp: now + token_res.expires_in,
        oauth_client_key: None,
        project_id,
        subscription_tier: None,
        custom_label: None,
        is_active: false,
        disabled: false,
        disabled_reason: None,
        quota: None,
        device_profile: None,
        created_at: now,
        last_used: now,
        order_index: db.get_next_antigravity_order_index()?,
    };

    if let Ok(quota) = fetch_quota(&account.access_token, account.project_id.as_deref()).await {
        account.subscription_tier = quota.subscription_tier.clone();
        account.quota = Some(quota);
    }

    let existing = db.list_antigravity_accounts()?;
    if existing.is_empty() {
        account.is_active = true;
    }

    db.upsert_antigravity_account(&account)?;
    Ok(account)
}

// ─── Import from Antigravity Manager ───

/// Result of importing accounts from Antigravity Manager
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: Vec<AntigravityAccount>,
    pub skipped: Vec<String>,  // emails that already exist
    pub errors: Vec<String>,   // per-file parse/read errors
}

/// Deserialization structures for Antigravity Manager's account JSON format
#[derive(Deserialize)]
struct AgManagerAccount {
    #[allow(dead_code)]
    id: String,
    email: String,
    name: Option<String>,
    token: Option<AgManagerToken>,
    quota: Option<AgManagerQuota>,
    disabled: Option<bool>,
    custom_label: Option<String>,
    created_at: Option<i64>,
    last_used: Option<i64>,
}

#[derive(Deserialize)]
struct AgManagerToken {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
    expiry_timestamp: Option<i64>,
    project_id: Option<String>,
    oauth_client_key: Option<String>,
}

#[derive(Deserialize)]
struct AgManagerQuota {
    models: Option<Vec<AgManagerModel>>,
    last_updated: Option<i64>,
    subscription_tier: Option<String>,
}

#[derive(Deserialize)]
struct AgManagerModel {
    name: String,
    percentage: Option<i32>,
    reset_time: Option<String>,
    display_name: Option<String>,
    supports_images: Option<bool>,
    supports_thinking: Option<bool>,
    thinking_budget: Option<i32>,
    recommended: Option<bool>,
    max_tokens: Option<i32>,
    max_output_tokens: Option<i32>,
}

fn get_antigravity_manager_accounts_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Home directory not found".to_string())?;
    let dir = home.join(".antigravity_tools").join("accounts");
    if !dir.exists() {
        return Err(format!(
            "Antigravity Manager accounts directory not found: {}",
            dir.display()
        ));
    }
    Ok(dir)
}

pub fn import_from_antigravity_manager(db: &Arc<Database>) -> Result<ImportResult, String> {
    let accounts_dir = get_antigravity_manager_accounts_dir()?;

    let entries = std::fs::read_dir(&accounts_dir)
        .map_err(|e| format!("Failed to read accounts directory: {}", e))?;

    let mut imported = Vec::new();
    let mut skipped = Vec::new();
    let mut errors = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();

        // Only process .json files
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                errors.push(format!("{}: read error: {}", file_name, e));
                continue;
            }
        };

        let ag_account: AgManagerAccount = match serde_json::from_str(&content) {
            Ok(a) => a,
            Err(e) => {
                errors.push(format!("{}: parse error: {}", file_name, e));
                continue;
            }
        };

        // Skip if email already exists in our database
        if db.find_antigravity_account_by_email(&ag_account.email)?.is_some() {
            skipped.push(ag_account.email);
            continue;
        }

        // Extract refresh_token - required for a useful account
        let refresh_token = match ag_account.token.as_ref().and_then(|t| t.refresh_token.as_ref()) {
            Some(rt) => rt.clone(),
            None => {
                errors.push(format!(
                    "{}: no refresh_token found for {}",
                    file_name, ag_account.email
                ));
                continue;
            }
        };

        let access_token = ag_account
            .token
            .as_ref()
            .and_then(|t| t.access_token.clone())
            .unwrap_or_default();

        let expires_in = ag_account
            .token
            .as_ref()
            .and_then(|t| t.expires_in)
            .unwrap_or(3600);

        let now = chrono::Utc::now().timestamp();
        let expiry_timestamp = ag_account
            .token
            .as_ref()
            .and_then(|t| t.expiry_timestamp)
            .unwrap_or(now + expires_in);

        let project_id = ag_account
            .token
            .as_ref()
            .and_then(|t| t.project_id.clone());

        let oauth_client_key = ag_account
            .token
            .as_ref()
            .and_then(|t| t.oauth_client_key.clone());

        // Map quota if present
        let quota = ag_account.quota.map(|q| {
            let models = q
                .models
                .unwrap_or_default()
                .into_iter()
                .map(|m| AntigravityModelQuota {
                    name: m.name,
                    percentage: m.percentage.unwrap_or(0),
                    reset_time: m.reset_time.unwrap_or_default(),
                    display_name: m.display_name,
                    supports_images: m.supports_images,
                    supports_thinking: m.supports_thinking,
                    thinking_budget: m.thinking_budget,
                    recommended: m.recommended,
                    max_tokens: m.max_tokens,
                    max_output_tokens: m.max_output_tokens,
                })
                .collect();

            AntigravityQuotaData {
                models,
                last_updated: q.last_updated.unwrap_or(now),
                is_forbidden: false,
                forbidden_reason: None,
                subscription_tier: q.subscription_tier,
            }
        });

        let subscription_tier = quota
            .as_ref()
            .and_then(|q| q.subscription_tier.clone());

        let is_active = false;
        let disabled = ag_account.disabled.unwrap_or(false);
        let order_index = db.get_next_antigravity_order_index()?;

        let account = AntigravityAccount {
            id: uuid::Uuid::new_v4().to_string(),
            email: ag_account.email,
            name: ag_account.name,
            access_token,
            refresh_token,
            expires_in,
            expiry_timestamp,
            oauth_client_key,
            project_id,
            subscription_tier,
            custom_label: ag_account.custom_label,
            is_active,
            disabled,
            disabled_reason: None,
            quota,
            device_profile: None,
            created_at: ag_account.created_at.unwrap_or(now),
            last_used: ag_account.last_used.unwrap_or(now),
            order_index,
        };

        db.upsert_antigravity_account(&account)?;
        imported.push(account);
    }

    // If no accounts were active before and we imported some, activate the first one
    let existing = db.list_antigravity_accounts()?;
    if existing.iter().all(|a| !a.is_active) && !imported.is_empty() {
        if let Some(first) = existing.first() {
            db.set_active_antigravity_account(&first.id)?;
        }
    }

    Ok(ImportResult {
        imported,
        skipped,
        errors,
    })
}

// --- Operation Log & Token Status ---

pub fn log_operation(
    db: &Arc<Database>,
    account_id: &str,
    email: &str,
    operation: &str,
    detail: Option<&str>,
) -> Result<(), String> {
    db.log_ag_operation(account_id, email, operation, detail)
}

pub fn get_operation_logs(
    db: &Arc<Database>,
    account_id: &str,
    limit: i64,
) -> Result<Vec<AgOperationLog>, String> {
    db.list_ag_operation_logs(account_id, limit)
}

pub fn get_all_operation_logs(
    db: &Arc<Database>,
    limit: i64,
) -> Result<Vec<AgOperationLog>, String> {
    db.list_all_ag_operation_logs(limit)
}

pub fn get_token_status(
    db: &Arc<Database>,
    id: &str,
) -> Result<TokenStatus, String> {
    let account = get_account(db, id)?;
    let now = chrono::Utc::now().timestamp();
    let expires_in_seconds = (account.expiry_timestamp - now).max(0);
    let is_valid = account.expiry_timestamp > now;

    let last_refreshed = db
        .get_last_token_refresh_log(id)?
        .map(|log| log.created_at)
        .unwrap_or(0);

    let refresh_count = db.get_token_refresh_count(id)?;

    Ok(TokenStatus {
        is_valid,
        expires_in_seconds,
        last_refreshed,
        refresh_count,
    })
}
