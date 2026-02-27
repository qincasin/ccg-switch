use std::env;
use std::io;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvIssue {
    #[serde(rename = "variable")]
    pub variable: String,
    #[serde(rename = "currentValue")]
    pub current_value: String,
    #[serde(rename = "source")]
    pub source: String,
    #[serde(rename = "severity")]
    pub severity: String,
    #[serde(rename = "suggestion")]
    pub suggestion: String,
}

/// 掩码敏感值，只显示前4后4字符
fn mask_value(val: &str) -> String {
    if val.len() <= 8 {
        return "*".repeat(val.len());
    }
    format!("{}...{}", &val[..4], &val[val.len()-4..])
}

/// 检查环境变量冲突
pub fn check_env_conflicts() -> Result<Vec<EnvIssue>, io::Error> {
    let mut issues = vec![];

    let check_vars = [
        ("ANTHROPIC_AUTH_TOKEN", "high", "Claude API Token set in environment may conflict with app-managed tokens"),
        ("ANTHROPIC_API_KEY", "high", "Claude API Key set in environment may conflict with app-managed keys"),
        ("ANTHROPIC_BASE_URL", "medium", "Base URL override may conflict with provider configuration"),
        ("CLAUDE_CODE_USE_BEDROCK", "medium", "Bedrock mode may conflict with direct API configuration"),
        ("CLAUDE_CODE_USE_VERTEX", "medium", "Vertex mode may conflict with direct API configuration"),
        ("HTTP_PROXY", "low", "HTTP proxy may affect API connections"),
        ("HTTPS_PROXY", "low", "HTTPS proxy may affect API connections"),
        ("ALL_PROXY", "low", "Global proxy may affect API connections"),
        ("NO_PROXY", "info", "No-proxy list may exclude certain domains"),
        ("ANTHROPIC_DEFAULT_SONNET_MODEL", "medium", "Model override in environment may conflict with app settings"),
        ("ANTHROPIC_DEFAULT_OPUS_MODEL", "medium", "Model override in environment may conflict with app settings"),
        ("ANTHROPIC_DEFAULT_HAIKU_MODEL", "medium", "Model override in environment may conflict with app settings"),
    ];

    for (var, severity, suggestion) in check_vars {
        if let Ok(val) = env::var(var) {
            if !val.is_empty() {
                issues.push(EnvIssue {
                    variable: var.to_string(),
                    current_value: mask_value(&val),
                    source: "environment".to_string(),
                    severity: severity.to_string(),
                    suggestion: suggestion.to_string(),
                });
            }
        }
    }

    Ok(issues)
}
