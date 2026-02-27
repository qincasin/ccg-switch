use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestLogEvent {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    #[serde(rename = "providerId")]
    pub provider_id: String,
    pub model: String,
    #[serde(rename = "inputTokens", default)]
    pub input_tokens: u64,
    #[serde(rename = "outputTokens", default)]
    pub output_tokens: u64,
    #[serde(rename = "totalTokens", default)]
    pub total_tokens: u64,
    #[serde(rename = "costUsd", default)]
    pub cost_usd: f64,
    #[serde(rename = "latencyMs", default)]
    pub latency_ms: u64,
    #[serde(default = "default_status")]
    pub status: u16,
    pub error: Option<String>,
}

fn default_status() -> u16 { 200 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDailySummary {
    pub requests: u64,
    #[serde(rename = "inputTokens")]
    pub input_tokens: u64,
    #[serde(rename = "outputTokens")]
    pub output_tokens: u64,
    #[serde(rename = "costUsd")]
    pub cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDailySummary {
    pub requests: u64,
    #[serde(rename = "inputTokens")]
    pub input_tokens: u64,
    #[serde(rename = "outputTokens")]
    pub output_tokens: u64,
    #[serde(rename = "costUsd")]
    pub cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageDailySummary {
    pub date: String,
    #[serde(rename = "totalRequests", default)]
    pub total_requests: u64,
    #[serde(rename = "totalInputTokens", default)]
    pub total_input_tokens: u64,
    #[serde(rename = "totalOutputTokens", default)]
    pub total_output_tokens: u64,
    #[serde(rename = "totalCostUsd", default)]
    pub total_cost_usd: f64,
    #[serde(rename = "byProvider", default)]
    pub by_provider: HashMap<String, ProviderDailySummary>,
    #[serde(rename = "byModel", default)]
    pub by_model: HashMap<String, ModelDailySummary>,
}
