use std::io;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct ModelInfo {
    id: String,
}

#[derive(Debug, Deserialize)]
struct ModelListResponse {
    data: Option<Vec<ModelInfo>>,
}

/// 从 API 获取可用模型列表
pub async fn fetch_models(url: String, api_key: String) -> Result<Vec<String>, io::Error> {
    if url.trim().is_empty() || api_key.trim().is_empty() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "URL and API Key are required"));
    }

    let base = url.trim().trim_end_matches('/');
    let endpoint = format!("{}/v1/models", base);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

    let response = client
        .get(&endpoint)
        .header("Authorization", format!("Bearer {}", api_key.trim()))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| io::Error::new(io::ErrorKind::ConnectionRefused, e.to_string()))?;

    if !response.status().is_success() {
        return Err(io::Error::new(
            io::ErrorKind::Other,
            format!("API returned status: {}", response.status()),
        ));
    }

    let body = response
        .text()
        .await
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;

    let parsed: ModelListResponse = serde_json::from_str(&body)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;

    let models: Vec<String> = parsed
        .data
        .unwrap_or_default()
        .into_iter()
        .filter(|m| !m.id.trim().is_empty())
        .map(|m| m.id)
        .collect();

    Ok(models)
}
