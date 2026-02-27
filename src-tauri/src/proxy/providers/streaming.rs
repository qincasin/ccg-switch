/// SSE 流式代理工具函数

/// 检查请求体 JSON 中是否包含 `"stream": true`
pub fn is_streaming_request(body: &[u8]) -> bool {
    // 快速字节扫描，避免完整 JSON 解析开销
    if let Ok(text) = std::str::from_utf8(body) {
        // 简单检测：寻找 "stream":true 或 "stream": true
        text.contains("\"stream\":true") || text.contains("\"stream\": true")
    } else {
        false
    }
}

/// 检查响应头中 Content-Type 是否为 SSE 流
pub fn is_sse_response(headers: &reqwest::header::HeaderMap) -> bool {
    headers
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|ct| ct.contains("text/event-stream"))
        .unwrap_or(false)
}
