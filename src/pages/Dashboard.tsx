import { useTranslation } from 'react-i18next';
import { Activity, BarChart3, Clock, Coins, FolderOpen, Hash, MessageSquare, RefreshCw } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface DashboardStats {
    num_startups: number;
    total_projects: number;
    total_sessions: number;
    total_history: number;
}

interface HistoryEntry {
    date: string;
    count: number;
}

interface ModelUsage {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    costUsd: number;
}

interface DailyModelTokens {
    date: string;
    tokensByModel: Record<string, number>;
}

interface StatsCache {
    modelUsage: Record<string, ModelUsage>;
    dailyModelTokens: DailyModelTokens[];
    hourCounts: Record<string, number>;
    totalSessions: number;
    totalMessages: number;
}

interface ProjectTokenStat {
    name: string;
    path: string;
    session_count: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
}

function Dashboard() {
    const { t } = useTranslation();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [activity, setActivity] = useState<HistoryEntry[]>([]);
    const [tokenStats, setTokenStats] = useState<StatsCache | null>(null);
    const [projectTokenStats, setProjectTokenStats] = useState<ProjectTokenStat[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);

        try {
            const statsData = await invoke<DashboardStats>('get_dashboard_stats');
            setStats(statsData);
        } catch (e) {
            console.error('Failed to load stats:', e);
        }

        try {
            const activityData = await invoke<HistoryEntry[]>('get_activity_history');
            setActivity(activityData);
        } catch (e) {
            console.error('Failed to load activity:', e);
        }

        try {
            const tokenData = await invoke<StatsCache>('get_stats_cache_data');
            setTokenStats(tokenData);
        } catch (e) {
            console.error('Failed to load token stats:', e);
        }

        try {
            const projectTokenData = await invoke<ProjectTokenStat[]>('get_project_token_stats');
            setProjectTokenStats(projectTokenData);
        } catch (e) {
            console.error('Failed to load project token stats:', e);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const recentActivity = activity.slice(-30);
    const maxCount = Math.max(...recentActivity.map(a => a.count), 1);

    const modelEntries = tokenStats ? Object.entries(tokenStats.modelUsage) : [];
    const totalTokens = modelEntries.reduce((sum, [, u]) => sum + u.inputTokens + u.outputTokens, 0);

    const recentTokenDays = (tokenStats?.dailyModelTokens || []).slice(-30);
    const dailyTotals = recentTokenDays.map(d => ({
        date: d.date,
        total: Object.values(d.tokensByModel).reduce((s, v) => s + v, 0),
    }));
    const maxDailyTokens = Math.max(...dailyTotals.map(d => d.total), 1);

    const hourData = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: tokenStats?.hourCounts?.[String(i)] || 0,
    }));
    const maxHourCount = Math.max(...hourData.map(h => h.count), 1);

    const topModels = [...modelEntries]
        .sort(([, a], [, b]) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens))
        .slice(0, 10);

    const topProjects = [...projectTokenStats]
        .sort((a, b) => b.total_tokens - a.total_tokens)
        .slice(0, 12);
    const maxProjectTokens = Math.max(...topProjects.map(p => p.total_tokens), 1);

    const linePoints = dailyTotals
        .map((d, i) => {
            const x = dailyTotals.length <= 1 ? 50 : (i / (dailyTotals.length - 1)) * 100;
            const y = 36 - (d.total / maxDailyTokens) * 32;
            return `${x},${y}`;
        })
        .join(' ');
    const areaPoints = dailyTotals.length > 0 ? `0,36 ${linePoints} 100,36` : '';

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-6 space-y-6 max-w-7xl mx-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-base-content">
                            {t('dashboard.welcome')}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            {t('dashboard.subtitle')}
                        </p>
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="btn btn-ghost btn-sm hover:bg-base-200 transition-all duration-200 hover:-translate-y-0.5"
                        title={t('common.refresh')}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <DualMetricCard
                            icon={Activity}
                            firstLabel={t('dashboard.stats_startups')}
                            firstValue={stats.num_startups}
                            secondLabel={t('token_usage.total_tokens')}
                            secondValue={totalTokens}
                            accent="text-blue-500"
                        />
                        <StatCard icon={Hash} label={t('dashboard.stats_sessions')} value={stats.total_sessions} color="text-purple-500" />
                        <StatCard icon={MessageSquare} label={t('token_usage.total_messages')} value={tokenStats?.totalMessages || 0} color="text-pink-500" />
                        <StatCard icon={FolderOpen} label={t('dashboard.stats_projects')} value={stats.total_projects} color="text-green-500" subValue={`${stats.total_history.toLocaleString()} ${t('dashboard.stats_history')}`} />
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    {recentActivity.length > 0 && (
                        <div className="xl:col-span-2 bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 className="w-5 h-5 text-gray-500" />
                                <h2 className="font-semibold text-gray-900 dark:text-base-content">
                                    {t('dashboard.activity_title')}
                                </h2>
                            </div>
                            <div className="flex">
                                <div className="flex flex-col justify-between h-36 pr-2 text-xs text-gray-400 shrink-0">
                                    <span>{maxCount}</span>
                                    <span>{Math.round(maxCount / 2)}</span>
                                    <span>0</span>
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <div className="flex items-end gap-1 h-36">
                                        {recentActivity.map((entry, i) => {
                                            const height = Math.max((entry.count / maxCount) * 100, 4);
                                            return (
                                                <div key={i} className="flex-1 h-full flex flex-col items-center justify-end group relative">
                                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                        {entry.count}
                                                    </div>
                                                    <div
                                                        className="w-full rounded-t bg-gradient-to-t from-blue-500 to-blue-400 dark:from-blue-600 dark:to-blue-400 transition-all duration-200 group-hover:from-blue-600 group-hover:to-blue-500 group-hover:scale-y-105 min-w-[4px]"
                                                        style={{ height: `${height}%` }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex gap-1 mt-1">
                                        {recentActivity.map((entry, i) => {
                                            const date = new Date(entry.date);
                                            return (
                                                <div key={i} className="flex-1 text-center">
                                                    <span className="text-[10px] text-gray-400">{`${date.getMonth() + 1}/${date.getDate()}`}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-gray-500" />
                            <h2 className="font-semibold text-gray-900 dark:text-base-content">
                                {t('token_usage.hourly_title')}
                            </h2>
                        </div>
                        <div className="flex items-end gap-[2px] h-36">
                            {hourData.map((h) => {
                                const height = Math.max((h.count / maxHourCount) * 100, 3);
                                return (
                                    <div key={h.hour} className="flex-1 h-full flex flex-col items-center justify-end group relative">
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                            {h.hour}:00 · {h.count}
                                        </div>
                                        <div
                                            className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-indigo-400 dark:from-indigo-600 dark:to-indigo-400 transition-all duration-200 group-hover:from-indigo-600 group-hover:to-indigo-500 group-hover:scale-y-105 min-w-[3px]"
                                            style={{ height: `${height}%` }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-[2px] mt-1">
                            {hourData.map((h) => (
                                <div key={h.hour} className="flex-1 text-center">
                                    <span className="text-[9px] text-gray-400">{h.hour % 6 === 0 ? `${h.hour}` : ''}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {dailyTotals.length > 0 && (
                    <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-5 h-5 text-emerald-500" />
                            <h2 className="font-semibold text-gray-900 dark:text-base-content">
                                {t('token_usage.daily_trend_title')}
                            </h2>
                            <span className="text-xs text-gray-400 ml-auto">
                                {dailyTotals.length} days
                            </span>
                        </div>

                        <div className="h-44 relative">
                            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
                                <line x1="0" y1="36" x2="100" y2="36" stroke="currentColor" className="text-gray-200 dark:text-base-300" />
                                <line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" className="text-gray-100 dark:text-base-300/50" />
                                {dailyTotals.length > 1 && (
                                    <>
                                        <polygon points={areaPoints} className="fill-emerald-200/35 dark:fill-emerald-500/15" />
                                        <polyline
                                            points={linePoints}
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.6"
                                            className="text-emerald-500"
                                        />
                                    </>
                                )}
                                {dailyTotals.map((d, i) => {
                                    const x = dailyTotals.length <= 1 ? 50 : (i / (dailyTotals.length - 1)) * 100;
                                    const y = 36 - (d.total / maxDailyTokens) * 32;
                                    return (
                                        <circle
                                            key={i}
                                            cx={x}
                                            cy={y}
                                            r="1.1"
                                            className="fill-emerald-500 transition-all duration-200 hover:r-[1.8]"
                                        >
                                            <title>{`${d.date}: ${d.total.toLocaleString()}`}</title>
                                        </circle>
                                    );
                                })}
                            </svg>
                        </div>

                        <div className="mt-2 flex justify-between text-[11px] text-gray-400">
                            <span>{dailyTotals[0]?.date || ''}</span>
                            <span>{dailyTotals[dailyTotals.length - 1]?.date || ''}</span>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                        <div className="flex items-center gap-2 mb-4">
                            <Coins className="w-5 h-5 text-amber-500" />
                            <h2 className="font-semibold text-gray-900 dark:text-base-content">
                                {t('token_usage.model_usage_title')}
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-base-200">
                                        <th className="text-left py-2 pr-4 font-medium">Model</th>
                                        <th className="text-right py-2 px-2 font-medium">{t('token_usage.input_tokens')}</th>
                                        <th className="text-right py-2 px-2 font-medium">{t('token_usage.output_tokens')}</th>
                                        <th className="text-right py-2 pl-2 font-medium">{t('token_usage.total_tokens')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topModels.map(([model, usage]) => (
                                        <tr key={model} className="border-b border-gray-50 dark:border-base-200 last:border-0 hover:bg-gray-50 dark:hover:bg-base-200 transition-colors">
                                            <td className="py-2 pr-4 font-medium text-gray-900 dark:text-base-content truncate max-w-[220px]" title={model}>
                                                {model}
                                            </td>
                                            <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-300">{usage.inputTokens.toLocaleString()}</td>
                                            <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-300">{usage.outputTokens.toLocaleString()}</td>
                                            <td className="py-2 pl-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                                {(usage.inputTokens + usage.outputTokens).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                        <div className="flex items-center gap-2 mb-4">
                            <FolderOpen className="w-5 h-5 text-cyan-500" />
                            <h2 className="font-semibold text-gray-900 dark:text-base-content">
                                {t('dashboard.project_token_title', '项目 Token 使用排行')}
                            </h2>
                        </div>
                        {topProjects.length === 0 ? (
                            <div className="text-sm text-gray-400">{t('dashboard.project_token_empty', '暂无项目 Token 数据')}</div>
                        ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                {topProjects.map((project) => (
                                    <div
                                        key={project.path}
                                        className="p-2.5 rounded-lg bg-gray-50 dark:bg-base-200 border border-transparent hover:border-cyan-200 dark:hover:border-cyan-700 transition-all duration-200 hover:-translate-y-0.5"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-gray-900 dark:text-base-content truncate" title={project.path}>
                                                    {project.name}
                                                </div>
                                                <div className="text-[11px] text-gray-400">
                                                    {project.session_count} {t('dashboard.projects_sessions')}
                                                </div>
                                            </div>
                                            <div className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 shrink-0">
                                                {project.total_tokens.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-base-300 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                                                style={{ width: `${Math.max((project.total_tokens / maxProjectTokens) * 100, 2)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
    color,
    subValue,
}: {
    icon: React.ElementType;
    label: string;
    value: number;
    color: string;
    subValue?: string;
}) {
    return (
        <div className="bg-white dark:bg-base-100 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-base-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${color}`} />
                <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-base-content">
                        {value.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                    {subValue && (
                        <div className="text-[11px] text-gray-400 mt-0.5">{subValue}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DualMetricCard({
    icon: Icon,
    firstLabel,
    firstValue,
    secondLabel,
    secondValue,
    accent,
}: {
    icon: React.ElementType;
    firstLabel: string;
    firstValue: number;
    secondLabel: string;
    secondValue: number;
    accent: string;
}) {
    return (
        <div className="bg-white dark:bg-base-100 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-base-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 mt-1 ${accent}`} />
                <div className="flex-1">
                    <div className="text-2xl font-bold text-gray-900 dark:text-base-content">
                        {firstValue.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{firstLabel}</div>

                    <div className="my-2 border-t border-dashed border-gray-200 dark:border-base-300" />

                    <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                        {secondValue.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{secondLabel}</div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
