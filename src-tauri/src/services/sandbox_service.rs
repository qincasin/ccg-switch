use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use crate::database::Database;
use std::sync::Arc;
use reqwest::Client;

#[derive(Debug, Serialize, Deserialize)]
pub struct SandboxRequest {
    pub provider_id: String,
    pub system_prompt: String,
    pub user_input: String,
    pub model: String,
    pub compare_mode: Option<bool>, // 是否启用对比模式
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SandboxResponse {
    pub content: String,
    pub compare_content: Option<String>, // 对比模式下的无技能输出
}

#[derive(Debug, PartialEq)]
enum ProtocolType {
    Anthropic,
    OpenAI,
}

impl ProtocolType {
    /// 判断使用何种协议，依据是 base_url 或者 model 名字
    fn detect(base_url: &str, model: &str) -> Self {
        let url_lower = base_url.to_lowercase();
        let model_lower = model.to_lowercase();
        if url_lower.contains("anthropic") || model_lower.contains("claude") {
            ProtocolType::Anthropic
        } else {
            ProtocolType::OpenAI
        }
    }
}

/// 单次请求辅助函数
async fn make_request(
    client: &Client,
    endpoint: &str,
    payload: &Value,
    protocol: &ProtocolType,
    api_key: &str,
) -> Result<String, String> {
    let mut request_builder = client.post(endpoint).json(payload);

    if !api_key.trim().is_empty() {
        if protocol == &ProtocolType::Anthropic {
            request_builder = request_builder
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01");
        } else {
            request_builder = request_builder.header("Authorization", format!("Bearer {}", api_key));
        }
    }

    let resp = request_builder
        .send()
        .await
        .map_err(|e| format!("请求异常: {}", e))?;

    let status = resp.status();
    let is_success = status.is_success();

    let body_text = resp.text().await
        .map_err(|e| format!("读取响应体失败: {}", e))?;

    // 尝试解析 JSON，针对错误进行智能降级提取
    let json_val_opt: Option<Value> = serde_json::from_str(&body_text).ok();

    if !is_success {
        if let Some(json_val) = &json_val_opt {
            let error_msg = extract_error_message(json_val);
            if !error_msg.is_empty() {
                return Err(format!("接口返回错误 [{}]: {}", status, error_msg));
            }
        }
        return Err(format!("接口返回错误 [{}]: {}", status, &body_text[..body_text.len().min(500)]));
    }

    let json_val = json_val_opt.ok_or_else(|| {
        format!("返回值非有效 JSON 格式\nHTTP状态码: {}\n原始响应: {}", status, &body_text[..body_text.len().min(500)])
    })?;

    let content = match protocol {
        ProtocolType::OpenAI => extract_openai_content(&json_val),
        ProtocolType::Anthropic => extract_anthropic_content(&json_val),
    };

    content.ok_or_else(|| {
        let potential_err = extract_error_message(&json_val);
        if !potential_err.is_empty() {
            format!("网关提示: {}", potential_err)
        } else {
            format!("模型未返回标准格式内容\n原始响应: {}", &body_text[..body_text.len().min(500)])
        }
    })
}

pub async fn run_sandbox_test(
    db: &Arc<Database>,
    req: SandboxRequest,
) -> Result<SandboxResponse, String> {
    // 1. 获取对应的 Provider 信息
    let provider = db.get_provider(&req.provider_id)
        .map_err(|e| format!("数据库查询失败: {}", e))?
        .ok_or_else(|| format!("未找到指定的模型服务提供商: {}", req.provider_id))?;

    let api_url_str = provider.url.unwrap_or_default();
    let api_url = api_url_str.trim_end_matches('/');

    let protocol = ProtocolType::detect(api_url, &req.model);

    // 2. 拼接端点 & 组装 Payload
    let endpoint: String;
    let payload: Value;

    match protocol {
        ProtocolType::OpenAI => {
            endpoint = if api_url.ends_with("/chat/completions") {
                api_url.to_string()
            } else if api_url.contains("/v1") {
                format!("{}/chat/completions", api_url)
            } else {
                format!("{}/v1/chat/completions", api_url)
            };

            let mut messages = Vec::new();
            if !req.system_prompt.trim().is_empty() {
                messages.push(json!({
                    "role": "system",
                    "content": req.system_prompt
                }));
            }
            messages.push(json!({
                "role": "user",
                "content": req.user_input
            }));

            payload = json!({
                "model": req.model,
                "messages": messages
            });
        }
        ProtocolType::Anthropic => {
            endpoint = if api_url.ends_with("/messages") {
                api_url.to_string()
            } else if api_url.contains("/v1") {
                format!("{}/messages", api_url)
            } else {
                format!("{}/v1/messages", api_url)
            };

            let messages = vec![json!({
                "role": "user",
                "content": req.user_input
            })];

            let mut p = json!({
                "model": req.model,
                "max_tokens": 4096,
                "messages": messages
            });

            if !req.system_prompt.trim().is_empty() {
                p.as_object_mut().unwrap().insert(
                    "system".to_string(),
                    json!(req.system_prompt)
                );
            }
            payload = p;
        }
    }

    let api_key = provider.api_key.clone();
    let client = Client::new();

    // 3. 根据模式发送请求
    if req.compare_mode.unwrap_or(false) {
        // 对比模式：并行发送两个请求

        // 准备无技能的 payload
        let mut payload_without_skill = payload.clone();
        match protocol {
            ProtocolType::OpenAI => {
                if let Some(arr) = payload_without_skill.get_mut("messages") {
                    if let Some(msgs) = arr.as_array_mut() {
                        msgs.retain(|msg| {
                            msg.get("role").and_then(|r| r.as_str()) != Some("system")
                        });
                    }
                }
            }
            ProtocolType::Anthropic => {
                payload_without_skill.as_object_mut()
                    .unwrap()
                    .remove("system");
            }
        }

        // 并行请求
        let (with_skill, without_skill) = tokio::join!(
            make_request(&client, &endpoint, &payload, &protocol, &api_key),
            make_request(&client, &endpoint, &payload_without_skill, &protocol, &api_key)
        );

        let content = with_skill.map_err(|e| format!("有技能请求失败: {}", e))?;
        let compare_content = without_skill.map_err(|e| format!("无技能请求失败: {}", e))?;

        Ok(SandboxResponse {
            content,
            compare_content: Some(compare_content),
        })
    } else {
        // 普通模式：单次请求
        let content = make_request(&client, &endpoint, &payload, &protocol, &api_key).await?;
        Ok(SandboxResponse {
            content,
            compare_content: None,
        })
    }
}

/// 尝试从杂乱无章的返回体中捞出错误摘要提示
fn extract_error_message(json_val: &Value) -> String {
    if let Some(err_obj) = json_val.get("error") {
        if let Some(msg) = err_obj.get("message").and_then(|v| v.as_str()) {
            return msg.to_string();
        }
        if let Some(msg) = err_obj.get("msg").and_then(|v| v.as_str()) {
            return msg.to_string();
        }
        return err_obj.to_string();
    }
    if let Some(msg) = json_val.get("msg").and_then(|v| v.as_str()) {
        return msg.to_string();
    }
    if let Some(msg) = json_val.get("message").and_then(|v| v.as_str()) {
        return msg.to_string();
    }
    if let Some(msg) = json_val.get("detail").and_then(|v| v.as_str()) {
        return msg.to_string();
    }
    String::new()
}

fn extract_openai_content(json_val: &Value) -> Option<String> {
    json_val.get("choices")
        .and_then(|c| c.get(0))
        .and_then(|first_choice| {
            first_choice.get("message")
                .and_then(|m| m.get("content"))
                .or_else(|| first_choice.get("delta").and_then(|d| d.get("content")))
        })
        .and_then(|val| val.as_str())
        .map(|s| s.to_string())
}

fn extract_anthropic_content(json_val: &Value) -> Option<String> {
    json_val.get("content")
        .and_then(|arr| arr.get(0))
        .and_then(|first_item| first_item.get("text"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}
