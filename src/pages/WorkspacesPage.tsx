import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, FolderOpen, Terminal, FileText, RefreshCw } from 'lucide-react';

interface ProjectInfo {
    name: string;
    path: string;
    session_count: number;
    last_active: string | null;
}

interface SessionInfo {
    session_id: string;
    file_path: string;
    last_modified: string | null;
    file_size: number;
    session_title?: string;
    session_preview?: string;
    session_slug?: string;
    last_message?: string;
    last_message_role?: string;
    last_message_at?: string;
}

function WorkspacesPage() {
    const { t } = useTranslation();
    const [projects, setProjects] = useState<ProjectInfo[]>([]);
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
    const [search, setSearch] = useState('');
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [loadingSessions, setLoadingSessions] = useState(false);

    const loadProjects = useCallback(async () => {
        setLoadingProjects(true);
        try {
            const data = await invoke<ProjectInfo[]>('get_dashboard_projects');
            setProjects(data);
        } catch (e) {
            console.error('Failed to load projects:', e);
        }
        setLoadingProjects(false);
    }, []);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const loadSessions = useCallback(async (project: ProjectInfo) => {
        setLoadingSessions(true);
        setSessions([]);
        try {
            const data = await invoke<SessionInfo[]>('get_project_sessions', { projectPath: project.path });
            setSessions(data);
        } catch (e) {
            console.error('Failed to load sessions:', e);
        }
        setLoadingSessions(false);
    }, []);

    const selectProject = (project: ProjectInfo) => {
        setSelectedProject(project);
        loadSessions(project);
    };

    const openTerminal = async (path: string) => {
        try {
            await invoke('open_in_terminal', { path });
        } catch (e) {
            console.error(t('workspaces.open_terminal_error'), e);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.path.toLowerCase().includes(search.toLowerCase())
    );

    const formatSize = (bytes: number) => {
        if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(1) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return bytes + ' B';
    };

    const formatSessionId = (id: string) => {
        if (id.length <= 18) return id;
        return `${id.slice(0, 8)}...${id.slice(-6)}`;
    };

    const getSessionTitle = (session: SessionInfo) => {
        if (session.session_title?.trim()) return session.session_title.trim();
        if (session.session_slug?.trim()) return session.session_slug.trim();
        return `${t('workspaces.session_id')} ${formatSessionId(session.session_id)}`;
    };

    const getRoleText = (role?: string) => {
        if (role === 'assistant') return t('workspaces.role_assistant');
        if (role === 'user') return t('workspaces.role_user');
        return t('workspaces.last_message');
    };

    return (
        <div className="h-full w-full overflow-hidden">
            <div className="p-6 h-full flex flex-col max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-base-content">
                            {t('workspaces.title')}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            {t('workspaces.subtitle')}
                        </p>
                    </div>
                    <button onClick={loadProjects} disabled={loadingProjects} className="btn btn-ghost btn-sm" title={t('common.refresh')}>
                        <RefreshCw className={`w-4 h-4 ${loadingProjects ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Main Content - Two Panel Layout */}
                <div className="flex-1 flex gap-4 min-h-0">
                    {/* Left Panel - Project List */}
                    <div className="w-80 shrink-0 flex flex-col bg-white dark:bg-base-100 rounded-xl shadow-sm border border-gray-100 dark:border-base-200 overflow-hidden">
                        {/* Search */}
                        <div className="p-3 border-b border-gray-100 dark:border-base-200">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t('workspaces.search_placeholder')}
                                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-base-200 border-none outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content placeholder-gray-400"
                                />
                            </div>
                        </div>

                        {/* Project List */}
                        <div className="flex-1 overflow-y-auto">
                            {loadingProjects ? (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                                </div>
                            ) : filteredProjects.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    {t('dashboard.projects_empty')}
                                </div>
                            ) : (
                                filteredProjects.map((project) => (
                                    <button
                                        key={project.path}
                                        onClick={() => selectProject(project)}
                                        className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-base-200 hover:bg-gray-50 dark:hover:bg-base-200 transition-colors ${
                                            selectedProject?.path === project.path ? 'bg-blue-50 dark:bg-base-200 border-l-2 border-l-blue-500' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
                                            <span className="font-medium text-sm text-gray-900 dark:text-base-content truncate">
                                                {project.name}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                                            <span>{project.session_count} {t('dashboard.projects_sessions')}</span>
                                            {project.last_active && (
                                                <span>{project.last_active}</span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Panel - Sessions */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-base-100 rounded-xl shadow-sm border border-gray-100 dark:border-base-200 overflow-hidden">
                        {!selectedProject ? (
                            <div className="flex-1 flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>{t('workspaces.select_project')}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Session Header */}
                                <div className="p-4 border-b border-gray-100 dark:border-base-200 flex items-center justify-between">
                                    <div>
                                        <h2 className="font-semibold text-gray-900 dark:text-base-content">
                                            {selectedProject.name}
                                        </h2>
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">{selectedProject.path}</p>
                                    </div>
                                    <button
                                        onClick={() => openTerminal(selectedProject.path)}
                                        className="btn btn-sm btn-ghost gap-1.5"
                                        title={t('workspaces.open_terminal')}
                                    >
                                        <Terminal className="w-4 h-4" />
                                        <span className="text-sm">{t('workspaces.open_terminal')}</span>
                                    </button>
                                </div>

                                {/* Session List */}
                                <div className="flex-1 overflow-y-auto">
                                    {loadingSessions ? (
                                        <div className="flex items-center justify-center py-8">
                                            <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                                        </div>
                                    ) : sessions.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 text-sm">
                                            {t('workspaces.no_sessions')}
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-50 dark:divide-base-200">
                                            {sessions.map((session) => (
                                                <div key={session.session_id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-base-200 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                                                        <span
                                                            className="font-medium text-sm text-gray-900 dark:text-base-content truncate"
                                                            title={session.session_title || session.session_slug || session.session_id}
                                                        >
                                                            {getSessionTitle(session)}
                                                        </span>
                                                        <span
                                                            className="ml-auto text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-base-300 text-gray-500 dark:text-gray-400"
                                                            title={session.session_id}
                                                        >
                                                            {formatSessionId(session.session_id)}
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6 truncate"
                                                        title={session.last_message || session.session_preview || t('workspaces.session_preview_empty')}
                                                    >
                                                        {session.last_message ? `${getRoleText(session.last_message_role)}: ${session.last_message}` : (session.session_preview || t('workspaces.session_preview_empty'))}
                                                    </div>
                                                    <div className="mt-1 flex items-center gap-4 text-xs text-gray-400 ml-6">
                                                        {session.last_message_at && (
                                                            <span>{session.last_message_at}</span>
                                                        )}
                                                        {session.last_modified && (
                                                            <span>{session.last_modified}</span>
                                                        )}
                                                        <span>{formatSize(session.file_size)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WorkspacesPage;
