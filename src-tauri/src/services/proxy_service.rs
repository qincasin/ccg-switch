use crate::models::proxy::ProxyConfig;
use crate::proxy::server;
use crate::proxy::types::ProxyState;

/// 启动代理服务器
pub async fn start_proxy(config: ProxyConfig) -> Result<ProxyState, String> {
    server::start(&config.host, config.port).await
}

/// 停止代理服务器
pub async fn stop_proxy() -> Result<(), String> {
    server::stop().await
}

/// 获取代理服务器状态
pub fn get_proxy_status() -> Result<ProxyState, String> {
    Ok(server::get_state())
}
