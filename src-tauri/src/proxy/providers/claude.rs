use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use crate::models::provider::Provider;
use crate::proxy::error::ProxyError;
use super::ProviderAdapter;

pub struct ClaudeAdapter;

impl ProviderAdapter for ClaudeAdapter {
    fn can_handle(&self, path: &str) -> bool {
        path.starts_with("/v1/messages") || path.starts_with("/v1/complete")
    }

    fn build_target_url(&self, provider: &Provider, path: &str, query: &str) -> Result<String, ProxyError> {
        let base = provider.url.as_deref().unwrap_or("https://api.anthropic.com");
        let base = base.trim_end_matches('/');
        Ok(format!("{}{}{}", base, path, query))
    }

    fn build_auth_headers(&self, provider: &Provider) -> Result<HeaderMap, ProxyError> {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        let base = provider.url.as_deref().unwrap_or("https://api.anthropic.com");
        if base.contains("anthropic.com") {
            // Anthropic 原生 API 使用 x-api-key
            headers.insert(
                "x-api-key",
                HeaderValue::from_str(&provider.api_key)
                    .map_err(|e| ProxyError::ConfigError(e.to_string()))?,
            );
            headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
        } else {
            // 第三方反代使用 Bearer token
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {}", provider.api_key))
                    .map_err(|e| ProxyError::ConfigError(e.to_string()))?,
            );
        }
        Ok(headers)
    }

    fn transform_request(&self, _body: &[u8]) -> Result<Option<Vec<u8>>, ProxyError> {
        Ok(None) // 直通，不转换
    }

    fn transform_response(&self, _body: &[u8]) -> Result<Option<Vec<u8>>, ProxyError> {
        Ok(None) // 直通
    }
}
