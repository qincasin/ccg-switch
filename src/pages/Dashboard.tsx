import { useTranslation } from 'react-i18next';
import { Settings, Server, FileText, Zap, Bot, Key, FolderOpen, BarChart3, Activity, Clock, Hash, RefreshCw, Coins, Layout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ProjectInfo {
    name: string;
    path: string;
    session_count: number;
    last_active: string | null;
}

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

function Dashboard() {
    const { t } = useTranslation();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [projects, setProjects] = useState<ProjectInfo[]>([]);
    const [activity, setActivity] = useState<HistoryEntry[]>([]);
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
            const projectsData = await invoke<ProjectInfo[]>('get_dashboard_projects');
            setProjects(projectsData);
        } catch (e) {
            console.error('Failed to load projects:', e);
        }

        try {
            const activityData = await invoke<HistoryEntry[]>('get_activity_history');
            setActivity(activityData);
        } catch (e) {
            console.error('Failed to load activity:', e);
        }

        setLoading(false);
    }, []);
    useEffect(() => {
        loadData();
    }, [loadData]);

    const modules = [
        {
            path: '/claude',
            icon: Key,
            title: t('nav.claude', 'Claude'),
            description: t('dashboard.claude_desc'),
            color: 'red'
        },
        {
            path: '/mcp',
            icon: Server,
            title: t('nav.mcp'),
            description: t('dashboard.mcp_desc'),
            color: 'blue'
        },
        {
            path: '/prompts',
            icon: FileText,
            title: t('nav.prompts'),
            description: t('dashboard.prompts_desc'),
            color: 'green'
        },
        {
            path: '/skills',
            icon: Zap,
            title: t('nav.skills'),
            description: t('dashboard.skills_desc'),
            color: 'purple'
        },
        {
            path: '/subagents',
            icon: Bot,
            title: t('nav.subagents'),
            description: t('dashboard.subagents_desc'),
            color: 'orange'
        },
        {
            path: '/token-usage',
            icon: Coins,
            title: t('nav.token_usage', 'Token Usage'),
            description: t('dashboard.token_usage_desc'),
            color: 'emerald'
        },
        {
            path: '/workspaces',
            icon: Layout,
            title: t('nav.workspaces', 'Workspaces'),
            description: t('dashboard.workspaces_desc'),
            color: 'cyan'
        },
    ];

    const colorClasses: Record<string, { bg: string; icon: string; border: string }> = {
        red: {
            bg: 'bg-red-50 dark:bg-red-900/20',
            icon: 'text-red-500 dark:text-red-400',
            border: 'border-red-100 dark:border-red-900/30 hover:border-red-300 dark:hover:border-red-700'
        },
        blue: {
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            icon: 'text-blue-500 dark:text-blue-400',
            border: 'border-blue-100 dark:border-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700'
        },
        green: {
            bg: 'bg-green-50 dark:bg-green-900/20',
            icon: 'text-green-500 dark:text-green-400',
            border: 'border-green-100 dark:border-green-900/30 hover:border-green-300 dark:hover:border-green-700'
        },
        purple: {
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            icon: 'text-purple-500 dark:text-purple-400',
            border: 'border-purple-100 dark:border-purple-900/30 hover:border-purple-300 dark:hover:border-purple-700'
        },
        orange: {
            bg: 'bg-orange-50 dark:bg-orange-900/20',
            icon: 'text-orange-500 dark:text-orange-400',
            border: 'border-orange-100 dark:border-orange-900/30 hover:border-orange-300 dark:hover:border-orange-700'
        },
        emerald: {
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
            icon: 'text-emerald-500 dark:text-emerald-400',
            border: 'border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-700'
        },
        cyan: {
            bg: 'bg-cyan-50 dark:bg-cyan-900/20',
            icon: 'text-cyan-500 dark:text-cyan-400',
            border: 'border-cyan-100 dark:border-cyan-900/30 hover:border-cyan-300 dark:hover:border-cyan-700'
        },
    };

    // 取最近30天的活跃数据用于图表
    const recentActivity = activity.slice(-30);
    const maxCount = Math.max(...recentActivity.map(a => a.count), 1);
    const formatRelativeTime = (isoStr: string | null) => {
        if (!isoStr) return '';
        const date = new Date(isoStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffDays === 0) return t('dashboard.projects_last_active') + ': 今天';
        if (diffDays === 1) return t('dashboard.projects_last_active') + ': 昨天';
        if (diffDays < 30) return t('dashboard.projects_last_active') + `: ${diffDays}天前`;
        return t('dashboard.projects_last_active') + `: ${date.toLocaleDateString('zh-CN')}`;
    };

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-6 space-y-6 max-w-7xl mx-auto">
                {/* 标题 + 刷新 */}
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
                        className="btn btn-ghost btn-sm"
                        title={t('common.refresh')}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* 统计卡片 */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={Activity} label={t('dashboard.stats_startups')} value={stats.num_startups} color="text-blue-500" />
                        <StatCard icon={FolderOpen} label={t('dashboard.stats_projects')} value={stats.total_projects} color="text-green-500" />
                        <StatCard icon={Hash} label={t('dashboard.stats_sessions')} value={stats.total_sessions} color="text-purple-500" />
                        <StatCard icon={Clock} label={t('dashboard.stats_history')} value={stats.total_history} color="text-orange-500" />
                    </div>
                )}
                {/* 会话活跃度图表 */}
                {recentActivity.length > 0 && (
                    <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-5 h-5 text-gray-500" />
                            <h2 className="font-semibold text-gray-900 dark:text-base-content">
                                {t('dashboard.activity_title')}
                            </h2>
                            <span className="text-xs text-gray-400 ml-auto">
                                {recentActivity.length} days
                            </span>
                        </div>
                        <div className="flex">
                            {/* Y轴 */}
                            <div className="flex flex-col justify-between h-32 pr-2 text-xs text-gray-400 shrink-0">
                                <span>{maxCount}</span>
                                <span>{Math.round(maxCount / 2)}</span>
                                <span>0</span>
                            </div>
                            {/* 柱状图 */}
                            <div className="flex-1 flex flex-col">
                                <div className="flex items-end gap-1 h-32">
                                    {recentActivity.map((entry, i) => {
                                        const height = Math.max((entry.count / maxCount) * 100, 4);
                                        return (
                                            <div key={i} className="flex-1 h-full flex flex-col items-center justify-end group relative">
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                    {entry.count}
                                                </div>
                                                <div
                                                    className="w-full rounded-t bg-gradient-to-t from-blue-500 to-blue-400 dark:from-blue-600 dark:to-blue-400 transition-all hover:from-blue-600 hover:to-blue-500 min-w-[4px]"
                                                    style={{ height: `${height}%` }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* X轴 */}
                                <div className="flex gap-1 mt-1">
                                    {recentActivity.map((entry, i) => {
                                        const date = new Date(entry.date);
                                        const dayStr = `${date.getMonth() + 1}/${date.getDate()}`;
                                        const showLabel = true;
                                        return (
                                            <div key={i} className="flex-1 text-center">
                                                <span className="text-[10px] text-gray-400">{showLabel ? dayStr : ''}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* 项目工作区列表 */}
                {projects.length > 0 && (
                    <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200">
                        <div className="flex items-center gap-2 mb-4">
                            <FolderOpen className="w-5 h-5 text-gray-500" />
                            <h2 className="font-semibold text-gray-900 dark:text-base-content">
                                {t('dashboard.projects_title')}
                            </h2>
                            <span className="text-xs text-gray-400 ml-auto">
                                {projects.length}
                            </span>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {projects.map((project, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-base-200 hover:bg-gray-100 dark:hover:bg-base-300 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-gray-900 dark:text-base-content truncate">
                                            {project.name}
                                        </div>
                                        <div className="text-xs text-gray-400 truncate" title={project.path}>
                                            {project.path}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                        <span className="text-xs text-gray-500">
                                            {project.session_count} {t('dashboard.projects_sessions')}
                                        </span>
                                        {project.last_active && (
                                            <span className="text-xs text-gray-400">
                                                {formatRelativeTime(project.last_active)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* 功能模块卡片 */}
                <div>
                    <h2 className="font-semibold text-gray-900 dark:text-base-content mb-3">
                        {t('dashboard.modules_title')}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {modules.map((module) => {
                            const colors = colorClasses[module.color];
                            return (
                                <Link
                                    key={module.path}
                                    to={module.path}
                                    className={`${colors.bg} rounded-xl p-4 shadow-sm border ${colors.border} hover:shadow-md transition-all group`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2.5 rounded-lg ${colors.bg}`}>
                                            <module.icon className={`w-5 h-5 ${colors.icon}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-sm text-gray-900 dark:text-base-content">
                                                {module.title}
                                            </h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {module.description}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* 设置入口 */}
                <Link
                    to="/settings"
                    className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-base-200 rounded-xl border border-gray-100 dark:border-base-300 hover:border-gray-300 dark:hover:border-base-100 hover:shadow-md transition-all"
                >
                    <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">{t('nav.settings')}</span>
                </Link>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
    return (
        <div className="bg-white dark:bg-base-100 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-base-200">
            <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${color}`} />
                <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-base-content">
                        {value.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;


