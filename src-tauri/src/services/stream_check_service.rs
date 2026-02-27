use std::io;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamCheckResult {
    #[serde(rename = "model")]
    pub model: String,
    #[serde(rename = "available")]
    pub available: bool,
    #[serde(rename = "latencyMs")]
    pub latency_ms: u64,
    #[serde(rename = "error")]
    pub error: Option<String>,
}

/// 检测模型 stream 可用性
pub async fn check_stream(url: String, api_key: String, model: String) -> Result<StreamCheckResult, io::Error> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": 5,
        "messages": [
            {
                "role": "user",
                "content": "Hi"
            }
        ],
        "stream": true
    });

    let start = std::time::Instant::now();

    let result = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await;

    let latency_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                Ok(StreamCheckResult {
                    model,
                    available: true,
                    latency_ms,
                    error: None,
                })
            } else {
                let error_text = response.text().await.unwrap_or_else(|_| status.to_string());
                Ok(StreamCheckResult {
                    model,
                    available: false,
                    latency_ms,
                    error: Some(error_text),
                })
            }
        }
        Err(e) => {
            Ok(StreamCheckResult {
                model,
                available: false,
                latency_ms,
                error: Some(e.to_string()),
            })
        }
    }
}
