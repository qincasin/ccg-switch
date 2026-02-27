import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard, Key, Globe, FileText, Zap,
    Bot, FolderOpen, Settings, Server
} from 'lucide-react';

const mainNavItems = [
    { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { path: '/providers', icon: Key, labelKey: 'nav.providers' },
    { path: '/proxy', icon: Server, labelKey: 'nav.proxy' },
    { path: '/mcp', icon: Globe, labelKey: 'nav.mcp' },
    { path: '/prompts', icon: FileText, labelKey: 'nav.prompts' },
    { path: '/skills', icon: Zap, labelKey: 'nav.skills' },
    { path: '/subagents', icon: Bot, labelKey: 'nav.subagents' },
    { path: '/workspaces', icon: FolderOpen, labelKey: 'nav.workspaces' },
];

const bottomNavItems = [
    { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

function Sidebar() {
    const location = useLocation();
    const { t } = useTranslation();

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    const renderNavItem = (item: typeof mainNavItems[0]) => {
        const Icon = item.icon;
        const active = isActive(item.path);

        return (
            <div key={item.path} className="tooltip tooltip-right" data-tip={t(item.labelKey)}>
                <Link
                    to={item.path}
                    className={`
                        relative flex items-center justify-center w-12 h-12 rounded-xl
                        transition-all duration-200 group
                        ${active
                            ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-base-200 hover:text-gray-700 dark:hover:text-gray-200'
                        }
                    `}
                >
                    {/* 左侧激活指示条 */}
                    {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-orange-500 rounded-r-full" />
                    )}
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.8} />
                </Link>
            </div>
        );
    };

    return (
        <aside className="w-16 h-full flex flex-col items-center bg-white dark:bg-base-100 border-r border-gray-200 dark:border-base-200 pt-12 pb-4">
            {/* 主导航 */}
            <nav className="flex-1 flex flex-col items-center gap-1 mt-2">
                {mainNavItems.map(renderNavItem)}
            </nav>

            {/* 底部导航 */}
            <nav className="flex flex-col items-center gap-1">
                {bottomNavItems.map(renderNavItem)}
            </nav>
        </aside>
    );
}

export default Sidebar;
