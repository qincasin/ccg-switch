use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyState {
    pub running: bool,
    pub port: u16,
    pub host: String,
    #[serde(rename = "requestCount")]
    pub request_count: u64,
}

impl Default for ProxyState {
    fn default() -> Self {
        Self {
            running: false,
            port: 8080,
            host: "127.0.0.1".to_string(),
            request_count: 0,
        }
    }
}
