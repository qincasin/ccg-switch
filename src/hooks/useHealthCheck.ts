import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type HealthState = 'idle' | 'checking' | 'operational' | 'degraded' | 'failed';

export interface HealthStatus {
    state: HealthState;
    latencyMs?: number;
    error?: string;
    lastChecked?: number;
}

interface ProviderHealthResult {
    providerId: string;
    appType: string;
    model: string;
    available: boolean;
    latencyMs: number;
    error?: string;
}

export function useHealthCheck() {
    const [statuses, setStatuses] = useState<Record<string, HealthStatus>>({});

    const checkSingle = useCallback(async (providerId: string) => {
        setStatuses(prev => ({
            ...prev,
            [providerId]: { state: 'checking' }
        }));

        try {
            const result = await invoke<ProviderHealthResult>('check_provider_health', { providerId });

            const state: HealthState = result.available
                ? (result.latencyMs > 5000 ? 'degraded' : 'operational')
                : 'failed';

            setStatuses(prev => ({
                ...prev,
                [providerId]: {
                    state,
                    latencyMs: result.latencyMs,
                    error: result.error || undefined,
                    lastChecked: Date.now(),
                }
            }));
        } catch (err) {
            setStatuses(prev => ({
                ...prev,
                [providerId]: {
                    state: 'failed',
                    error: String(err),
                    lastChecked: Date.now(),
                }
            }));
        }
    }, []);

    const checkBatch = useCallback(async (providerIds: string[], concurrency = 5) => {
        setStatuses(prev => {
            const next = { ...prev };
            for (const id of providerIds) {
                next[id] = { state: 'checking' };
            }
            return next;
        });

        const queue = [...providerIds];
        let running = 0;

        await new Promise<void>((resolve) => {
            const runNext = () => {
                if (queue.length === 0 && running === 0) {
                    resolve();
                    return;
                }
                while (running < concurrency && queue.length > 0) {
                    const id = queue.shift()!;
                    running++;
                    checkSingle(id).finally(() => {
                        running--;
                        runNext();
                    });
                }
            };
            runNext();
        });
    }, [checkSingle]);

    const isAnyChecking = Object.values(statuses).some(s => s.state === 'checking');

    const clearAll = useCallback(() => {
        setStatuses({});
    }, []);

    return { statuses, checkSingle, checkBatch, isAnyChecking, clearAll };
}
