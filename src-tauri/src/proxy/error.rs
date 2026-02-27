use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

#[derive(Debug, thiserror::Error)]
pub enum ProxyError {
    #[error("No active provider found")]
    NoActiveProvider,
    #[error("Upstream request failed: {0}")]
    UpstreamError(String),
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    #[error("Configuration error: {0}")]
    ConfigError(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl IntoResponse for ProxyError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            ProxyError::NoActiveProvider => (StatusCode::SERVICE_UNAVAILABLE, self.to_string()),
            ProxyError::UpstreamError(_) => (StatusCode::BAD_GATEWAY, self.to_string()),
            ProxyError::InvalidRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            ProxyError::ConfigError(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            ProxyError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };
        let body = serde_json::json!({ "error": message });
        (status, axum::Json(body)).into_response()
    }
}
