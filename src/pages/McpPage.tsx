import { useTranslation } from 'react-i18next';
import { Server, Plus, RefreshCw, Trash2, Edit, Globe, Folder, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMcpStore } from '../stores/useMcpStore';
import { useMcpStoreV2 } from '../stores/useMcpStoreV2';
import McpEditDialog from '../components/mcp/McpEditDialog';
import ModalDialog from '../components/common/ModalDialog';
import { McpServer, APP_KEYS, APP_LABELS } from '../types/mcp';
import { McpServerRow, MCP_V2_APPS } from '../types/mcpV2';
import { showToast } from '../components/common/ToastContainer';

// 应用过滤标签（"全部" + 5 个应用）
const ALL_TAB = 'all';

// ========== V2 服务器卡片 ==========
function McpServerRowCard({ server, onDelete, onToggleApp }: {
    server: McpServerRow;
    onDelete: (id: string) => void;
    onToggleApp: (id: string, app: string, enabled: boolean) => void;
}) {
    const { t } = useTranslation();
    const cfg = server.serverConfig;
    return (
        <div className="bg-white dark:bg-base-100 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-base-200 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-base-content">{server.name}</h3>
                        {server.description && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">{server.description}</span>
                        )}
                    </div>
                    <div className="space-y-1 text-sm">
                        {cfg.command && (
                            <p className="text-gray-600 dark:text-gray-400">
                                <span className="font-medium">{t('mcp.command')}:</span> {cfg.command}
                                {cfg.args && cfg.args.length > 0 && ` ${cfg.args.join(' ')}`}
                            </p>
                        )}
                        {cfg.url && (
                            <p className="text-gray-600 dark:text-gray-400">
                                <span className="font-medium">URL:</span> {cfg.url}
                            </p>
                        )}
                    </div>
                    {/* 多应用开关 */}
                    <div className="mt-3 flex items-center gap-4">
                        {MCP_V2_APPS.map(({ key, label, app }) => (
                            <label key={app} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="toggle toggle-xs toggle-primary"
                                    checked={server[key]}
                                    onChange={(e) => onToggleApp(server.id, app, e.target.checked)}
                                />
                                <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <button
                    onClick={() => onDelete(server.id)}
                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-4"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function McpPage() {
    const { t } = useTranslation();
    const [pageTab, setPageTab] = useState<'legacy' | 'v2'>('v2');

    // ---- Legacy (v1) state ----
    const { servers, loading, loadServers, deleteServer, addServer, currentApp, setCurrentApp, toggleServerForApp } = useMcpStore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingServer, setEditingServer] = useState<McpServer | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; serverName: string; isGlobal: boolean }>({
        isOpen: false, serverName: '', isGlobal: false
    });

    // ---- V2 state ----
    const { servers: v2Servers, loading: v2Loading, loadServers: loadV2, deleteServer: deleteV2, toggleApp: toggleV2App, importFromApps } = useMcpStoreV2();
    const [v2DeleteModal, setV2DeleteModal] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });

    useEffect(() => {
        if (pageTab === 'legacy') loadServers();
        else loadV2();
    }, [pageTab]);

    // ----- Legacy handlers -----
    const handleRefresh = () => loadServers();
    const handleAdd = () => { setEditingServer(null); setIsDialogOpen(true); };
    const handleEdit = (server: McpServer) => { setEditingServer(server); setIsDialogOpen(true); };
    const handleSave = async (server: McpServer, isGlobal: boolean) => { await addServer(server, isGlobal); };
    const handleDelete = (serverName: string, isGlobal: boolean) => {
        setDeleteModal({ isOpen: true, serverName, isGlobal });
    };
    const confirmDelete = async () => {
        try {
            await deleteServer(deleteModal.serverName, deleteModal.isGlobal);
            showToast(t('mcp.delete_success'), 'success');
        } catch { showToast(t('mcp.delete_failed'), 'error'); }
        finally { setDeleteModal({ isOpen: false, serverName: '', isGlobal: false }); }
    };
    const filteredServers = currentApp && currentApp !== ALL_TAB
        ? servers.filter((s) => !s.apps || Object.keys(s.apps).length === 0 || s.apps[currentApp] !== false)
        : servers;
    const getAppEnabled = (server: McpServer, app: string): boolean =>
        !server.apps || Object.keys(server.apps).length === 0 || server.apps[app] !== false;
    const handleAppToggle = async (server: McpServer, app: string, enabled: boolean) => {
        try { await toggleServerForApp(server.name, server.source === 'global', app, enabled); }
        catch { showToast(t('mcp.toggle_failed'), 'error'); }
    };

    // ----- V2 handlers -----
    const handleV2Delete = (id: string) => setV2DeleteModal({ isOpen: true, id });
    const confirmV2Delete = async () => {
        try {
            await deleteV2(v2DeleteModal.id);
            showToast(t('mcp.delete_success'), 'success');
        } catch { showToast(t('mcp.delete_failed'), 'error'); }
        finally { setV2DeleteModal({ isOpen: false, id: '' }); }
    };
    const handleImport = async () => {
        try {
            const count = await importFromApps();
            showToast(`已导入 ${count} 个 MCP 服务器`, 'success');
        } catch (e) { showToast(String(e), 'error'); }
    };

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-6 space-y-4 max-w-7xl mx-auto">
                {/* 标题栏 */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Server className="w-6 h-6 text-blue-500" />
                        <h1 className="text-xl font-bold text-gray-900 dark:text-base-content">{t('nav.mcp')}</h1>
                    </div>
                    <div className="flex gap-2">
                        {pageTab === 'v2' ? (
                            <>
                                <button onClick={handleImport} disabled={v2Loading}
                                    className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                                    <Download className="w-4 h-4" />
                                    从应用导入
                                </button>
                                <button onClick={() => loadV2()} disabled={v2Loading}
                                    className="px-3 py-1.5 bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-base-100 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                                    <RefreshCw className={`w-4 h-4 ${v2Loading ? 'animate-spin' : ''}`} />
                                    {t('common.refresh')}
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={handleRefresh} disabled={loading}
                                    className="px-3 py-1.5 bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-base-100 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                    {t('common.refresh')}
                                </button>
                                <button onClick={handleAdd}
                                    className="px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1.5">
                                    <Plus className="w-4 h-4" />
                                    {t('common.add')}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* 页面级标签切换 */}
                <div className="flex gap-2 border-b border-gray-200 dark:border-base-300">
                    <button onClick={() => setPageTab('v2')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${pageTab === 'v2' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                        统一管理
                    </button>
                    <button onClick={() => setPageTab('legacy')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${pageTab === 'legacy' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                        本地文件
                    </button>
                </div>

                {/* ===== 统一管理 (V2) ===== */}
                {pageTab === 'v2' && (
                    v2Loading ? (
                        <div className="bg-white dark:bg-base-100 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-base-200 text-center">
                            <RefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
                            <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
                        </div>
                    ) : v2Servers.length === 0 ? (
                        <div className="bg-white dark:bg-base-100 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-base-200 text-center">
                            <Server className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-500 dark:text-gray-400">{t('mcp.empty')}</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                                点击"从应用导入"将现有 Claude/Gemini 配置导入到统一管理
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {v2Servers.map((server) => (
                                <McpServerRowCard
                                    key={server.id}
                                    server={server}
                                    onDelete={handleV2Delete}
                                    onToggleApp={(id, app, enabled) => toggleV2App(id, app, enabled)}
                                />
                            ))}
                        </div>
                    )
                )}

                {/* ===== 本地文件 (Legacy) ===== */}
                {pageTab === 'legacy' && (
                    <>
                        {/* 应用过滤标签 */}
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={() => setCurrentApp(null)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${!currentApp || currentApp === ALL_TAB ? 'bg-gray-900 dark:bg-base-content text-white dark:text-base-100' : 'bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-base-100'}`}>
                                {t('mcp.all_apps')}
                            </button>
                            {APP_KEYS.map((appKey) => (
                                <button key={appKey} onClick={() => setCurrentApp(appKey)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${currentApp === appKey ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-base-100'}`}>
                                    {APP_LABELS[appKey]}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="bg-white dark:bg-base-100 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-base-200 text-center">
                                <RefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
                                <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
                            </div>
                        ) : filteredServers.length === 0 ? (
                            <div className="bg-white dark:bg-base-100 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-base-200 text-center">
                                <Server className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400">{t('mcp.empty')}</p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('mcp.empty_hint')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {filteredServers.map((server) => (
                                    <div key={server.id} className="bg-white dark:bg-base-100 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-base-200 hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="font-semibold text-gray-900 dark:text-base-content">{server.name}</h3>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${server.source === 'global' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                                                        {server.source === 'global' ? (<span className="flex items-center gap-1"><Globe className="w-3 h-3" />{t('mcp.global')}</span>) : (<span className="flex items-center gap-1"><Folder className="w-3 h-3" />{t('mcp.project')}</span>)}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${server.transport === 'stdio' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'}`}>
                                                        {server.transport.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="space-y-1 text-sm">
                                                    {server.command && (<p className="text-gray-600 dark:text-gray-400"><span className="font-medium">{t('mcp.command')}:</span> {server.command}</p>)}
                                                    {server.url && (<p className="text-gray-600 dark:text-gray-400"><span className="font-medium">{t('mcp.url')}:</span> {server.url}</p>)}
                                                    {server.args && server.args.length > 0 && (<p className="text-gray-600 dark:text-gray-400"><span className="font-medium">{t('mcp.args')}:</span> {server.args.join(' ')}</p>)}
                                                </div>
                                                {currentApp && currentApp !== ALL_TAB && (
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">{APP_LABELS[currentApp as keyof typeof APP_LABELS] ?? currentApp}:</span>
                                                        <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={getAppEnabled(server, currentApp)} onChange={(e) => handleAppToggle(server, currentApp, e.target.checked)} />
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">{getAppEnabled(server, currentApp) ? t('mcp.app_enabled') : t('mcp.app_disabled')}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2 ml-4">
                                                <button onClick={() => handleEdit(server)} className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(server.name, server.source === 'global')} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* 添加/编辑对话框 */}
                <McpEditDialog isOpen={isDialogOpen} server={editingServer} onClose={() => setIsDialogOpen(false)} onSave={handleSave} />

                {/* 删除确认（v1）*/}
                <ModalDialog isOpen={deleteModal.isOpen} title={t('mcp.delete_title')} message={t('mcp.confirm_delete')} type="confirm" isDestructive={true} onConfirm={confirmDelete} onCancel={() => setDeleteModal({ isOpen: false, serverName: '', isGlobal: false })} />

                {/* 删除确认（v2）*/}
                <ModalDialog isOpen={v2DeleteModal.isOpen} title={t('mcp.delete_title')} message={t('mcp.confirm_delete')} type="confirm" isDestructive={true} onConfirm={confirmV2Delete} onCancel={() => setV2DeleteModal({ isOpen: false, id: '' })} />
            </div>
        </div>
    );
}

export default McpPage;
