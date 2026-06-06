//! Antigravity 账号相关的数据模型。
//!
//! 所有结构体使用 `camelCase` 序列化以匹配前端 TypeScript 接口。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityAccount {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub expiry_timestamp: i64,
    pub oauth_client_key: Option<String>,
    pub project_id: Option<String>,
    pub subscription_tier: Option<String>,
    pub custom_label: Option<String>,
    #[serde(default)]
    pub is_active: bool,
    #[serde(default)]
    pub disabled: bool,
    pub disabled_reason: Option<String>,
    pub quota: Option<AntigravityQuotaData>,
    pub device_profile: Option<AntigravityDeviceProfile>,
    pub created_at: i64,
    pub last_used: i64,
    pub order_index: i32,
}

impl AntigravityAccount {
    pub fn new(email: String, refresh_token: String, access_token: String, expires_in: i64) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            email,
            name: None,
            access_token,
            refresh_token,
            expires_in,
            expiry_timestamp: now + expires_in,
            oauth_client_key: None,
            project_id: None,
            subscription_tier: None,
            custom_label: None,
            is_active: false,
            disabled: false,
            disabled_reason: None,
            quota: None,
            device_profile: None,
            created_at: now,
            last_used: now,
            order_index: 0,
        }
    }

    pub fn is_token_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        now >= self.expiry_timestamp - 900
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityQuotaData {
    pub models: Vec<AntigravityModelQuota>,
    pub last_updated: i64,
    #[serde(default)]
    pub is_forbidden: bool,
    pub forbidden_reason: Option<String>,
    pub subscription_tier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityModelQuota {
    pub name: String,
    pub percentage: i32,
    pub reset_time: String,
    pub display_name: Option<String>,
    pub supports_images: Option<bool>,
    pub supports_thinking: Option<bool>,
    pub thinking_budget: Option<i32>,
    pub recommended: Option<bool>,
    pub max_tokens: Option<i32>,
    pub max_output_tokens: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityDeviceProfile {
    pub machine_id: String,
    pub mac_machine_id: String,
    pub dev_device_id: String,
    pub sqm_id: String,
}

#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub expires_in: i64,
    #[serde(default)]
    pub token_type: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UserInfo {
    pub email: String,
    pub name: Option<String>,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
    pub picture: Option<String>,
}

impl UserInfo {
    pub fn get_display_name(&self) -> Option<String> {
        if let Some(name) = &self.name {
            if !name.trim().is_empty() {
                return Some(name.clone());
            }
        }
        match (&self.given_name, &self.family_name) {
            (Some(given), Some(family)) => Some(format!("{} {}", given, family)),
            (Some(given), None) => Some(given.clone()),
            (None, Some(family)) => Some(family.clone()),
            (None, None) => None,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshStats {
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub details: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgOperationLog {
    pub id: i64,
    pub account_id: String,
    pub account_email: String,
    pub operation: String,
    pub detail: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenStatus {
    pub is_valid: bool,
    pub expires_in_seconds: i64,
    pub last_refreshed: i64,
    pub refresh_count: i64,
}
