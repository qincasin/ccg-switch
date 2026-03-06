#![allow(dead_code)]
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use crate::models::provider::Provider;
use crate::proxy::error::ProxyError;
use super::ProviderAdapter;

/// Google Gemini 协议适配器
/// 支持路径：/v1beta/... 或 /gemini/...
/// 认证方式：query param ?key=API_KEY
/// 请求/响应透传
pub struct GeminiAdapter;

impl ProviderAdapter for GeminiAdapter {
    fn can_handle(&self, path: &str) -> bool {
        path.starts_with("/v1beta") || path.starts_with("/gemini")
    }

    fn build_target_url(&self, provider: &Provider, path: &str, query: &str) -> Result<String, ProxyError> {
        let base = provider
            .url
            .as_deref()
            .unwrap_or("https://generativelanguage.googleapis.com");
        let base = base.trim_end_matches('/');

        // Gemini 认证通过 query param: ?key=API_KEY
        // 若已有 query 参数则用 & 拼接，否则用 ? 起始
        let auth_param = format!("key={}", provider.api_key);
        let full_query = if query.is_empty() {
            format!("?{}", auth_param)
        } else {
            // query 已含前导 '?'，追加 &key=...
            format!("{}&{}", query, auth_param)
        };

        Ok(format!("{}{}{}", base, path, full_query))
    }

    fn build_auth_headers(&self, _provider: &Provider) -> Result<HeaderMap, ProxyError> {
        // Gemini 不使用 Authorization 头，认证在 URL query param 中
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        Ok(headers)
    }

    fn transform_request(&self, _body: &[u8]) -> Result<Option<Vec<u8>>, ProxyError> {
        // 透传
        Ok(None)
    }

    fn transform_response(&self, _body: &[u8]) -> Result<Option<Vec<u8>>, ProxyError> {
        // 透传
        Ok(None)
    }
}
