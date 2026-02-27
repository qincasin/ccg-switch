pub mod claude;
pub mod gemini;
pub mod openai;
pub mod streaming;
pub mod transform;

use reqwest::header::HeaderMap;
use crate::proxy::error::ProxyError;
use crate::models::provider::Provider;

/// 统一的 provider 适配器接口
pub trait ProviderAdapter: Send + Sync {
    /// 检测是否能处理该请求路径
    fn can_handle(&self, path: &str) -> bool;

    /// 构建转发目标 URL
    fn build_target_url(&self, provider: &Provider, path: &str, query: &str) -> Result<String, ProxyError>;

    /// 构建认证头
    fn build_auth_headers(&self, provider: &Provider) -> Result<HeaderMap, ProxyError>;

    /// 转换请求体（OpenAI→Anthropic 等格式转换）
    /// 返回 None 表示不需要转换，直接透传
    fn transform_request(&self, body: &[u8]) -> Result<Option<Vec<u8>>, ProxyError>;

    /// 转换响应体
    /// 返回 None 表示不需要转换
    fn transform_response(&self, body: &[u8]) -> Result<Option<Vec<u8>>, ProxyError>;
}

/// 按路径选择合适的 adapter
pub fn select_adapter(path: &str) -> Box<dyn ProviderAdapter> {
    // Gemini 路径：/v1beta/... 或 /gemini/...
    if path.starts_with("/v1beta") || path.starts_with("/gemini") {
        return Box::new(gemini::GeminiAdapter);
    }
    // OpenAI 兼容路径：/v1/chat/completions 等
    if path.starts_with("/v1/") {
        return Box::new(openai::OpenAIAdapter);
    }
    // 默认 Claude
    Box::new(claude::ClaudeAdapter)
}
