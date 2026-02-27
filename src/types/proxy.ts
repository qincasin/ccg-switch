export interface ProxyConfig {
    port: number;
    host: string;
    enabled: boolean;
    takeoverMode: boolean;
    authToken?: string;
}

export interface ProxyState {
    running: boolean;
    port: number;
    host: string;
    requestCount: number;
}

export type CircuitBreakerState = 'closed' | 'open' | 'halfopen';

export interface ProviderHealth {
    providerId: string;
    state: CircuitBreakerState;
    failureCount: number;
    lastFailure?: string;
    lastSuccess?: string;
}
