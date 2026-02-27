use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use crate::models::provider::Provider;
use crate::proxy::error::ProxyError;
use super::ProviderAdapter;

/// OpenAI 兼容协议适配器
/// 支持路径：/v1/chat/completions、/v1/completions、/v1/embeddings 等
/// 认证方式：Bearer token
/// 请求/响应透传（第三方反代通常已处理格式转换）
pub struct OpenAIAdapter;

impl ProviderAdapter for OpenAIAdapter {
    fn can_handle(&self, path: &str) -> bool {
        path.starts_with("/v1/")
    }

    fn build_target_url(&self, provider: &Provider, path: &str, query: &str) -> Result<String, ProxyError> {
        let base = provider.url.as_deref().unwrap_or("https://api.openai.com");
        let base = base.trim_end_matches('/');
        Ok(format!("{}{}{}", base, path, query))
    }

    fn build_auth_headers(&self, provider: &Provider) -> Result<HeaderMap, ProxyError> {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", provider.api_key))
                .map_err(|e| ProxyError::ConfigError(e.to_string()))?,
        );
        Ok(headers)
    }

    fn transform_request(&self, _body: &[u8]) -> Result<Option<Vec<u8>>, ProxyError> {
        // 透传：第三方反代通常已处理 OpenAI→Anthropic 格式转换
        Ok(None)
    }

    fn transform_response(&self, _body: &[u8]) -> Result<Option<Vec<u8>>, ProxyError> {
        // 透传
        Ok(None)
    }
}
