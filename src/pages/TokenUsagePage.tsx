import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BarChart3, Coins, MessageSquare, Clock, RefreshCw, Activity } from 'lucide-react';

interface ModelUsage {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
    web_search_requests: number;
    cost_usd: number;
}

interface DailyModelTokens {
    date: string;
    tokens_by_model: Record<string, number>;
}

interface LongestSession {
    session_id: string;
    duration: number;
    message_count: number;
    timestamp: string;
}

interface StatsCache {
    version: number;
    daily_activity: Array<{ date: string; message_count: number; session_count: number; tool_call_count: number }>;
    daily_model_tokens: DailyModelTokens[];
    model_usage: Record<string, ModelUsage>;
    total_sessions: number;
    total_messages: number;
    longest_session: LongestSession | null;
    first_session_date: string | null;
    hour_counts: Record<string, number>;
}

function TokenUsagePage() {
    const { t } = useTranslation();
    const [stats, setStats] = useState<StatsCache | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await invoke<StatsCache>('get_stats_cache_data');
            setStats(data);
        } catch (e) {
            console.error('Failed to load stats cache:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!stats || Object.keys(stats.model_usage).length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t('token_usage.no_data')}</p>
                </div>
            </div>
        );
    }

    // Compute totals
    const totalTokens = Object.values(stats.model_usage).reduce(
        (sum, m) => sum + m.input_tokens + m.output_tokens + m.cache_read_input_tokens + m.cache_creation_input_tokens, 0
    );
    const totalCost = Object.values(stats.model_usage).reduce((sum, m) => sum + m.cost_usd, 0);

    // Top model by cost
    const topModel = Object.entries(stats.model_usage).sort((a, b) => b[1].cost_usd - a[1].cost_usd)[0];

    // Daily token trend (last 30 days)
    const recentDaily = stats.daily_model_tokens.slice(-30);
    const dailyTotals = recentDaily.map(d => ({
        date: d.date,
        total: Object.values(d.tokens_by_model).reduce((s, v) => s + v, 0),
    }));
    const maxDailyTokens = Math.max(...dailyTotals.map(d => d.total), 1);

    // Hourly distribution
    const hourEntries = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: stats.hour_counts[String(i)] || 0,
    }));
    const maxHourCount = Math.max(...hourEntries.map(h => h.count), 1);

    const formatTokens = (n: number) => {
        if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
        return n.toLocaleString();
    };

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-6 space-y-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-base-content">
                            {t('token_usage.title')}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            {t('token_usage.subtitle')}
                        </p>
                    </div>
                    <button onClick={loadData} disabled={loading} className="btn btn-ghost btn-sm" title={t('common.refresh')}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <SummaryCard icon={BarChart3} label={t('token_usage.total_tokens')} value={formatTokens(totalTokens)} color="text-blue-500" />
                    <SummaryCard icon={Coins} label={t('token_usage.total_cost')} value={`$${totalCost.toFixed(2)}`} color="text-green-500" />
                    <SummaryCard icon={MessageSquare} label={t('token_usage.total_sessions')} value={stats.total_sessions.toLocaleString()} color="text-purple-500" />
                    <SummaryCard icon={Activity} label={t('token_usage.total_messages')} value={stats.total_messages.toLocaleString()} color="text-orange-500" />
                </div>

                {/* Model Usage Table */}
                <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200">
                    <h2 className="font-semibold text-gray-900 dark:text-base-content mb-4">
                        {t('token_usage.model_usage_title')}
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-base-200">
                                    <th className="pb-2 pr-4 font-medium">Model</th>
                                    <th className="pb-2 pr-4 font-medium text-right">{t('token_usage.input_tokens')}</th>
                                    <th className="pb-2 pr-4 font-medium text-right">{t('token_usage.output_tokens')}</th>
                                    <th className="pb-2 pr-4 font-medium text-right">{t('token_usage.cache_read')}</th>
                                    <th className="pb-2 pr-4 font-medium text-right">{t('token_usage.cache_creation')}</th>
                                    <th className="pb-2 font-medium text-right">{t('token_usage.cost')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(stats.model_usage)
                                    .sort((a, b) => b[1].cost_usd - a[1].cost_usd)
                                    .map(([model, usage]) => (
                                        <tr key={model} className="border-b border-gray-50 dark:border-base-200 hover:bg-gray-50 dark:hover:bg-base-200">
                                            <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-base-content">{model}</td>
                                            <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-300">{formatTokens(usage.input_tokens)}</td>
                                            <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-300">{formatTokens(usage.output_tokens)}</td>
                                            <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-300">{formatTokens(usage.cache_read_input_tokens)}</td>
                                            <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-300">{formatTokens(usage.cache_creation_input_tokens)}</td>
                                            <td className="py-2.5 text-right font-medium text-gray-900 dark:text-base-content">${usage.cost_usd.toFixed(2)}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Daily Token Trend */}
                {dailyTotals.length > 0 && (
                    <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-5 h-5 text-gray-500" />
                            <h2 className="font-semibold text-gray-900 dark:text-base-content">
                                {t('token_usage.daily_trend_title')}
                            </h2>
                            <span className="text-xs text-gray-400 ml-auto">{dailyTotals.length} days</span>
                        </div>
                        <div className="flex">
                            <div className="flex flex-col justify-between h-32 pr-2 text-xs text-gray-400 shrink-0">
                                <span>{formatTokens(maxDailyTokens)}</span>
                                <span>{formatTokens(Math.round(maxDailyTokens / 2))}</span>
                                <span>0</span>
                            </div>
                            <div className="flex-1 flex flex-col">
                                <div className="flex items-end gap-1 h-32">
                                    {dailyTotals.map((entry, i) => {
                                        const height = Math.max((entry.total / maxDailyTokens) * 100, 4);
                                        return (
                                            <div key={i} className="flex-1 h-full flex flex-col items-center justify-end group relative">
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                    {formatTokens(entry.total)}
                                                </div>
                                                <div
                                                    className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-emerald-400 dark:from-emerald-600 dark:to-emerald-400 transition-all hover:from-emerald-600 hover:to-emerald-500 min-w-[4px]"
                                                    style={{ height: `${height}%` }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-1 mt-1">
                                    {dailyTotals.map((entry, i) => {
                                        const date = new Date(entry.date);
                                        const dayStr = `${date.getMonth() + 1}/${date.getDate()}`;
                                        return (
                                            <div key={i} className="flex-1 text-center">
                                                <span className="text-[10px] text-gray-400">{dayStr}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Hourly Distribution */}
                <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-gray-500" />
                        <h2 className="font-semibold text-gray-900 dark:text-base-content">
                            {t('token_usage.hourly_title')}
                        </h2>
                    </div>
                    <div className="flex">
                        <div className="flex flex-col justify-between h-32 pr-2 text-xs text-gray-400 shrink-0">
                            <span>{maxHourCount}</span>
                            <span>{Math.round(maxHourCount / 2)}</span>
                            <span>0</span>
                        </div>
                        <div className="flex-1 flex flex-col">
                            <div className="flex items-end gap-1 h-32">
                                {hourEntries.map((entry) => {
                                    const height = Math.max((entry.count / maxHourCount) * 100, 4);
                                    return (
                                        <div key={entry.hour} className="flex-1 h-full flex flex-col items-center justify-end group relative">
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                {entry.count}
                                            </div>
                                            <div
                                                className="w-full rounded-t bg-gradient-to-t from-purple-500 to-purple-400 dark:from-purple-600 dark:to-purple-400 transition-all hover:from-purple-600 hover:to-purple-500 min-w-[4px]"
                                                style={{ height: `${height}%` }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex gap-1 mt-1">
                                {hourEntries.map((entry) => (
                                    <div key={entry.hour} className="flex-1 text-center">
                                        <span className="text-[10px] text-gray-400">{entry.hour}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Session Statistics */}
                <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200">
                    <h2 className="font-semibold text-gray-900 dark:text-base-content mb-4">
                        {t('token_usage.session_stats_title')}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stats.first_session_date && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-base-200">
                                <Clock className="w-5 h-5 text-blue-500" />
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('token_usage.first_session')}</div>
                                    <div className="font-medium text-gray-900 dark:text-base-content">{stats.first_session_date}</div>
                                </div>
                            </div>
                        )}
                        {stats.longest_session && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-base-200">
                                <Activity className="w-5 h-5 text-purple-500" />
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('token_usage.longest_session')}</div>
                                    <div className="font-medium text-gray-900 dark:text-base-content">
                                        {t('token_usage.duration_minutes', { minutes: Math.round(stats.longest_session.duration / 60) })}
                                        {' · '}
                                        {stats.longest_session.message_count} {t('token_usage.messages')}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Model Highlight */}
                {topModel && (
                    <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.token_summary_top_model')}</div>
                                <div className="text-lg font-bold text-gray-900 dark:text-base-content">{topModel[0]}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-500 dark:text-gray-400">{t('token_usage.cost')}</div>
                                <div className="text-lg font-bold text-green-600">${topModel[1].cost_usd.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
    return (
        <div className="bg-white dark:bg-base-100 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-base-200">
            <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${color}`} />
                <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-base-content">{value}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                </div>
            </div>
        </div>
    );
}

export default TokenUsagePage;
