#![allow(dead_code)]
use std::collections::HashMap;
use std::sync::OnceLock;

/// 内置的基础定价（USD per 1M tokens）
/// key: 模型名前缀
/// value: (input_price_per_1m, output_price_per_1m)
fn builtin_pricing() -> &'static HashMap<String, (f64, f64)> {
    static PRICING: OnceLock<HashMap<String, (f64, f64)>> = OnceLock::new();
    PRICING.get_or_init(|| {
        let mut map = HashMap::new();
        // Claude 系列
        map.insert("claude-opus-4".to_string(), (15.0, 75.0));
        map.insert("claude-sonnet-4".to_string(), (3.0, 15.0));
        map.insert("claude-haiku-4".to_string(), (0.8, 4.0));
        map.insert("claude-opus-3".to_string(), (15.0, 75.0));
        map.insert("claude-sonnet-3".to_string(), (3.0, 15.0));
        map.insert("claude-haiku-3".to_string(), (0.25, 1.25));
        // OpenAI 系列
        map.insert("gpt-4o-mini".to_string(), (0.15, 0.6));
        map.insert("gpt-4o".to_string(), (2.5, 10.0));
        // Gemini 系列
        map.insert("gemini-1.5-pro".to_string(), (1.25, 5.0));
        map.insert("gemini-1.5-flash".to_string(), (0.075, 0.30));
        map
    })
}

/// 按前缀匹配定价表，返回 (input_price_per_1m, output_price_per_1m)
///
/// 匹配规则：使用最长前缀优先（即 gpt-4o-mini 比 gpt-4o 更具体）
fn lookup_pricing(model: &str) -> Option<(f64, f64)> {
    let pricing = builtin_pricing();
    let model_lower = model.to_lowercase();

    // 找到所有匹配的前缀，选取最长的
    pricing
        .iter()
        .filter(|(prefix, _)| model_lower.starts_with(prefix.as_str()))
        .max_by_key(|(prefix, _)| prefix.len())
        .map(|(_, prices)| *prices)
}

/// 计算成本（USD）
///
/// 按前缀匹配定价表：
/// cost = input_tokens * input_price / 1_000_000 + output_tokens * output_price / 1_000_000
///
/// 未知模型返回 0.0
pub fn calculate_cost(model: &str, input_tokens: u64, output_tokens: u64) -> f64 {
    match lookup_pricing(model) {
        Some((input_price, output_price)) => {
            (input_tokens as f64 * input_price / 1_000_000.0)
                + (output_tokens as f64 * output_price / 1_000_000.0)
        }
        None => 0.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_cost_claude_sonnet() {
        // 1M input + 1M output = 3.0 + 15.0 = 18.0 USD
        let cost = calculate_cost("claude-sonnet-4-5", 1_000_000, 1_000_000);
        assert!((cost - 18.0).abs() < 0.001);
    }

    #[test]
    fn test_calculate_cost_gpt4o_mini_prefix() {
        // gpt-4o-mini 应优先匹配，而非 gpt-4o
        let cost_mini = calculate_cost("gpt-4o-mini", 1_000_000, 0);
        let cost_4o = calculate_cost("gpt-4o", 1_000_000, 0);
        assert!((cost_mini - 0.15).abs() < 0.001);
        assert!((cost_4o - 2.5).abs() < 0.001);
    }

    #[test]
    fn test_calculate_cost_unknown_model() {
        let cost = calculate_cost("unknown-model-xyz", 1_000_000, 1_000_000);
        assert_eq!(cost, 0.0);
    }
}
