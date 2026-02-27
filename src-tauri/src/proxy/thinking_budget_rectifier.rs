use crate::proxy::error::ProxyError;
use serde_json::Value;

// budget 相关错误关键字
const BUDGET_ERROR_MESSAGES: &[&str] = &[
    "budget_tokens",
    "budget",
    "token budget",
];

/// 检测响应是否包含 budget_tokens 相关错误
pub fn is_budget_error(status: u16, body: &[u8]) -> bool {
    if status != 400 && status != 422 {
        return false;
    }

    let text = match std::str::from_utf8(body) {
        Ok(t) => t,
        Err(_) => return false,
    };

    let lower = text.to_lowercase();
    if !lower.contains("budget") {
        return false;
    }

    if let Ok(val) = serde_json::from_str::<Value>(text) {
        // {"error": {"type": "...", "message": "..."}}
        if let Some(err) = val.get("error") {
            if let Some(msg) = err.get("message").and_then(|v| v.as_str()) {
                let msg_lower = msg.to_lowercase();
                return BUDGET_ERROR_MESSAGES
                    .iter()
                    .any(|kw| msg_lower.contains(kw));
            }
        }
        // 直接顶层 message 字段
        if let Some(msg) = val.get("message").and_then(|v| v.as_str()) {
            let msg_lower = msg.to_lowercase();
            return BUDGET_ERROR_MESSAGES
                .iter()
                .any(|kw| msg_lower.contains(kw));
        }
    }

    false
}

/// 修复请求体：调整或移除 budget_tokens 字段
///
/// 策略：
/// - 若 thinking.budget_tokens 存在，先尝试减半（最小 1024）
/// - 若已低于 1024，则移除整个 thinking 对象
/// - 若无修改，返回 None
pub fn rectify_request(body: &[u8]) -> Result<Option<Vec<u8>>, ProxyError> {
    let mut val: Value = serde_json::from_slice(body)
        .map_err(|e| ProxyError::InvalidRequest(format!("JSON parse error: {e}")))?;

    let mut modified = false;

    // 处理 thinking.budget_tokens
    let should_remove_thinking = if let Some(thinking) = val.get_mut("thinking") {
        if let Some(budget) = thinking.get("budget_tokens").and_then(|b| b.as_u64()) {
            if budget <= 1024 {
                // 预算已经很低，移除整个 thinking
                true
            } else {
                // 减半预算
                let new_budget = (budget / 2).max(1024);
                thinking["budget_tokens"] = Value::Number(new_budget.into());
                modified = true;
                false
            }
        } else {
            // budget_tokens 不存在，移除整个 thinking
            true
        }
    } else {
        false
    };

    if should_remove_thinking {
        if let Some(obj) = val.as_object_mut() {
            obj.remove("thinking");
            modified = true;
        }
    }

    if modified {
        let bytes = serde_json::to_vec(&val)
            .map_err(|e| ProxyError::Internal(format!("JSON serialize error: {e}")))?;
        Ok(Some(bytes))
    } else {
        Ok(None)
    }
}
