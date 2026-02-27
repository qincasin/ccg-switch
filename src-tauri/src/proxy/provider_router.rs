use crate::models::app_type::AppType;
use crate::proxy::error::ProxyError;
use crate::services::provider_service;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};

/// 路由结果：目标 URL、认证头、额外头
pub struct RouteResult {
    pub target_url: String,
    pub headers: HeaderMap,
}

/// 根据当前活跃 provider 解析上游目标
pub fn resolve_upstream(request_path: &str) -> Result<RouteResult, ProxyError> {
    // 获取 Claude 应用的活跃 provider
    let providers = provider_service::list_providers(AppType::Claude)
        .map_err(|e| ProxyError::Internal(e.to_string()))?;

    let active = providers
        .into_iter()
        .find(|p| p.is_active)
        .ok_or(ProxyError::NoActiveProvider)?;

    // 构建目标 URL
    let base_url = active
        .url
        .as_deref()
        .unwrap_or("https://api.anthropic.com");
    let base_url = base_url.trim_end_matches('/');
    let target_url = format!("{}{}", base_url, request_path);

    // 构建请求头
    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );

    // 根据 URL 判断认证方式
    if base_url.contains("anthropic.com") {
        // Anthropic 原生 API 使用 x-api-key
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(&active.api_key)
                .map_err(|e| ProxyError::ConfigError(e.to_string()))?,
        );
    } else {
        // 第三方反代通常使用 Bearer token
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", active.api_key))
                .map_err(|e| ProxyError::ConfigError(e.to_string()))?,
        );
    }

    Ok(RouteResult {
        target_url,
        headers,
    })
}
