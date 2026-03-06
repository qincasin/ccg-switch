#![allow(dead_code)]
/// 请求/响应体格式转换工具函数
///
/// 当前阶段实现为透传框架，后续可按需扩展具体转换逻辑。
/// 例如：OpenAI chat/completions ↔ Anthropic messages 格式互转。

/// 将 OpenAI chat completions 请求体转换为 Anthropic messages 格式
/// 当前返回 None（透传），保留函数签名供后续扩展
pub fn openai_to_anthropic(_body: &[u8]) -> Option<Vec<u8>> {
    None
}

/// 将 Anthropic messages 响应体转换为 OpenAI chat completions 格式
/// 当前返回 None（透传），保留函数签名供后续扩展
pub fn anthropic_to_openai(_body: &[u8]) -> Option<Vec<u8>> {
    None
}
