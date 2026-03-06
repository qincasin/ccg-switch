#![allow(dead_code)]
use crate::models::app_type::AppType;
use crate::models::provider::Provider;
use crate::models::proxy::CircuitBreakerConfig;
use crate::proxy::circuit_breaker;
use crate::proxy::error::ProxyError;
use crate::services::provider_service;

/// 获取当前可用的 provider（跳过熔断中的）
///
/// 优先选取：
/// 1. is_active = true 且熔断器允许的 provider
/// 2. 若活跃 provider 被熔断，则从 in_failover_queue = true 的 providers 中
///    选取第一个熔断器允许通过的
pub fn get_available_provider(app: AppType) -> Result<Provider, ProxyError> {
    let config = circuit_breaker::default_config();
    let providers = provider_service::list_providers(app)
        .map_err(|e| ProxyError::ConfigError(e.to_string()))?;

    if providers.is_empty() {
        return Err(ProxyError::NoActiveProvider);
    }

    // 尝试当前活跃 provider
    if let Some(active) = providers.iter().find(|p| p.is_active) {
        if circuit_breaker::is_request_allowed(&active.id, &config) {
            return Ok(active.clone());
        }
    }

    // 活跃 provider 被熔断，从故障转移队列中选取
    let fallback = providers
        .iter()
        .filter(|p| p.in_failover_queue && !p.is_active)
        .find(|p| circuit_breaker::is_request_allowed(&p.id, &config));

    fallback
        .cloned()
        .ok_or(ProxyError::NoActiveProvider)
}

/// 处理 provider 请求成功
pub fn on_success(provider_id: &str, _config: &CircuitBreakerConfig) {
    circuit_breaker::record_success(provider_id);
}

/// 处理 provider 请求失败，触发熔断检查，必要时返回下一个可用 provider id
pub fn on_failure(
    app: AppType,
    provider_id: &str,
    config: &CircuitBreakerConfig,
) -> Option<String> {
    let new_state = circuit_breaker::record_failure(provider_id, config);

    use crate::models::proxy::CircuitBreakerState;
    match new_state {
        CircuitBreakerState::Open => {
            // 熔断触发，寻找下一个可用 provider
            let providers = provider_service::list_providers(app).ok()?;
            let next = providers
                .iter()
                .filter(|p| p.id != provider_id && p.in_failover_queue)
                .find(|p| circuit_breaker::is_request_allowed(&p.id, config));
            next.map(|p| p.id.clone())
        }
        _ => None,
    }
}
