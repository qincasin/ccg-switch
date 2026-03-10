import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HealthStatus } from '../../hooks/useHealthCheck';

interface HealthStatusBadgeProps {
    status?: HealthStatus;
    compact?: boolean;
}

export default function HealthStatusBadge({ status, compact = false }: HealthStatusBadgeProps) {
    const { t } = useTranslation();

    if (!status || status.state === 'idle') return null;

    if (status.state === 'checking') {
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-base-content/40" />;
    }

    if (status.state === 'operational') {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                {!compact && (
                    <span className="text-green-600 dark:text-green-400">
                        {t('providers.health_status_operational')}
                    </span>
                )}
                {status.latencyMs !== undefined && (
                    <span className="text-base-content/50">{status.latencyMs}ms</span>
                )}
            </span>
        );
    }

    if (status.state === 'degraded') {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                {!compact && (
                    <span className="text-yellow-600 dark:text-yellow-400">
                        {t('providers.health_status_degraded')}
                    </span>
                )}
                {status.latencyMs !== undefined && (
                    <span className="text-base-content/50">{status.latencyMs}ms</span>
                )}
            </span>
        );
    }

    // failed
    return (
        <span className="inline-flex items-center gap-1.5 text-xs" title={status.error || ''}>
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            {!compact && (
                <span className="text-red-600 dark:text-red-400">
                    {t('providers.health_status_failed')}
                </span>
            )}
            {status.error && compact && (
                <span className="text-base-content/40 truncate max-w-[120px]">
                    {status.error.substring(0, 50)}
                </span>
            )}
        </span>
    );
}
