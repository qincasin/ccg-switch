use crate::error::AppError;
use super::DeepLinkImportRequest;
use super::utils::validate_url;

/// 解析 deep link URL 为 DeepLinkImportRequest
pub fn parse_deeplink_url(url_str: &str) -> Result<DeepLinkImportRequest, AppError> {
    let parsed = url::Url::parse(url_str).map_err(|e| {
        AppError::InvalidInput(format!("URL 解析失败: {} ({})", url_str, e))
    })?;

    // 校验 scheme 必须为 ccswitch 或 ccgswitch
    match parsed.scheme() {
        "ccswitch" | "ccgswitch" => {}
        scheme => {
            return Err(AppError::InvalidInput(format!(
                "不支持的 URL scheme: {}，仅支持 ccswitch:// 或 ccgswitch://",
                scheme
            )));
        }
    }

    // version（host）必须为 v1
    let version = parsed.host_str().unwrap_or("");
    if version != "v1" {
        return Err(AppError::InvalidInput(format!(
            "不支持的版本: {}，当前仅支持 v1",
            version
        )));
    }

    // path 必须为 /import
    let path = parsed.path();
    if path != "/import" {
        return Err(AppError::InvalidInput(format!(
            "不支持的路径: {}，当前仅支持 /import",
            path
        )));
    }

    // 提取 query params
    let params: std::collections::HashMap<String, String> = parsed
        .query_pairs()
        .map(|(k, v): (std::borrow::Cow<str>, std::borrow::Cow<str>)| (k.to_string(), v.to_string()))
        .collect();

    // resource 必须为 provider
    let resource = params
        .get("resource")
        .cloned()
        .unwrap_or_default();
    if resource != "provider" {
        return Err(AppError::InvalidInput(format!(
            "不支持的 resource 类型: {}，当前仅支持 provider",
            resource
        )));
    }

    // 必填参数: app
    let app = params.get("app").cloned();
    if let Some(ref app_value) = app {
        let valid_apps = ["claude", "codex", "gemini", "opencode", "openclaw"];
        let lower = app_value.to_lowercase();
        if !valid_apps.contains(&lower.as_str()) {
            return Err(AppError::InvalidInput(format!(
                "不支持的 app 类型: {}，支持: {}",
                app_value,
                valid_apps.join(", ")
            )));
        }
    } else {
        return Err(AppError::InvalidInput(
            "缺少必填参数: app".to_string(),
        ));
    }

    // 必填参数: name
    let name = params.get("name").cloned();
    if name.is_none() || name.as_deref() == Some("") {
        return Err(AppError::InvalidInput(
            "缺少必填参数: name".to_string(),
        ));
    }

    // 可选参数
    let endpoint = params.get("endpoint").cloned();
    let api_key = params.get("apiKey").cloned();
    let model = params.get("model").cloned();
    let sonnet_model = params.get("sonnetModel").cloned();
    let opus_model = params.get("opusModel").cloned();
    let haiku_model = params.get("haikuModel").cloned();
    let homepage = params.get("homepage").cloned();
    let icon = params.get("icon").cloned();
    let notes = params.get("notes").cloned();
    let enabled = params.get("enabled").map(|v| v == "true" || v == "1");
    let config = params.get("config").cloned();
    let config_format = params.get("configFormat").cloned();
    let config_url = params.get("configUrl").cloned();

    // 校验 URL 格式
    if let Some(ref hp) = homepage {
        validate_url(hp, "homepage")?;
    }
    if let Some(ref ep) = endpoint {
        // endpoint 可能是逗号分隔的多个 URL，逐一校验
        for url_part in ep.split(',') {
            let trimmed = url_part.trim();
            if !trimmed.is_empty() {
                validate_url(trimmed, "endpoint")?;
            }
        }
    }

    Ok(DeepLinkImportRequest {
        version: version.to_string(),
        resource,
        app,
        name,
        enabled,
        homepage,
        endpoint,
        api_key,
        icon,
        model,
        notes,
        haiku_model,
        sonnet_model,
        opus_model,
        config,
        config_format,
        config_url,
    })
}
