use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiToken {
    pub id: String,
    pub name: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    pub url: Option<String>,
    #[serde(rename = "defaultSonnetModel")]
    pub default_sonnet_model: Option<String>,
    #[serde(rename = "defaultOpusModel")]
    pub default_opus_model: Option<String>,
    #[serde(rename = "defaultHaikuModel")]
    pub default_haiku_model: Option<String>,
    #[serde(rename = "customParams")]
    pub custom_params: Option<HashMap<String, serde_json::Value>>,
    pub description: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "lastUsed")]
    pub last_used: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokensConfig {
    pub tokens: Vec<ApiToken>,
}
