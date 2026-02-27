use serde_json::Value;

/// 从响应体字节中提取 token 用量（支持 Claude 和 OpenAI 格式）
///
/// Claude 格式: response.usage.{ input_tokens, output_tokens }
/// OpenAI 格式: response.usage.{ prompt_tokens, completion_tokens }
///
/// 返回 (input_tokens, output_tokens)，解析失败返回 (0, 0)
pub fn extract_usage(body: &[u8]) -> (u64, u64) {
    let json: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (0, 0),
    };

    let usage = match json.get("usage") {
        Some(u) => u,
        None => return (0, 0),
    };

    // 尝试 Claude 格式：input_tokens / output_tokens
    let input = usage.get("input_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let output = usage.get("output_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    if input > 0 || output > 0 {
        return (input, output);
    }

    // 尝试 OpenAI 格式：prompt_tokens / completion_tokens
    let input = usage.get("prompt_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let output = usage.get("completion_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    (input, output)
}

/// 从响应体中提取模型名
///
/// 解析 response.model 字段，失败返回 fallback
pub fn extract_model(body: &[u8], fallback: &str) -> String {
    let json: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return fallback.to_string(),
    };

    json.get("model")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| fallback.to_string())
}
