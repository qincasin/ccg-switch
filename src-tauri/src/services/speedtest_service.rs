use std::io;
use serde::{Deserialize, Serialize};
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedTestResult {
    #[serde(rename = "url")]
    pub url: String,
    #[serde(rename = "latencyMs")]
    pub latency_ms: u64,
    #[serde(rename = "status")]
    pub status: String,
    #[serde(rename = "timestamp")]
    pub timestamp: String,
}

/// 测试端点延迟
pub async fn test_endpoint(url: String, api_key: String) -> Result<SpeedTestResult, io::Error> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

    let start = std::time::Instant::now();

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| io::Error::new(io::ErrorKind::ConnectionRefused, e.to_string()))?;

    let latency_ms = start.elapsed().as_millis() as u64;
    let status = response.status().to_string();

    Ok(SpeedTestResult {
        url,
        latency_ms,
        status,
        timestamp: Utc::now().to_rfc3339(),
    })
}
