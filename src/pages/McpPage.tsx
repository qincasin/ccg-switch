import { useTranslation } from 'react-i18next';
import { Server, Plus, RefreshCw, Trash2, Edit, Globe, Folder } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMcpStore } from '../stores/useMcpStore';
import McpEditDialog from '../components/mcp/McpEditDialog';
import ModalDialog from '../components/common/ModalDialog';
import { McpServer } from '../types/mcp';
import { showToast } from '../components/common/ToastContainer';

function McpPage() {
    const { t } = useTranslation();
    const { servers, loading, loadServers, deleteServer, addServer } = useMcpStore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingServer, setEditingServer] = useState<McpServer | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; serverName: string; isGlobal: boolean }>({
        isOpen: false,
        serverName: '',
        isGlobal: false
    });

    useEffect(() => {
        loadServers();
    }, [loadServers]);

    const handleRefresh = () => {
        loadServers();
    };

    const handleAdd = () => {
        setEditingServer(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (server: McpServer) => {
        setEditingServer(server);
        setIsDialogOpen(true);
    };

    const handleSave = async (server: McpServer, isGlobal: boolean) => {
        await addServer(server, isGlobal);
    };

    const handleDelete = async (serverName: string, isGlobal: boolean) => {
        setDeleteModal({ isOpen: true, serverName, isGlobal });
    };

    const confirmDelete = async () => {
        try {
            await deleteServer(deleteModal.serverName, deleteModal.isGlobal);
            showToast(t('mcp.delete_success'), 'success');
        } catch (error) {
            showToast(t('mcp.delete_failed'), 'error');
        } finally {
            setDeleteModal({ isOpen: false, serverName: '', isGlobal: false });
        }
    };

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-6 space-y-4 max-w-7xl mx-auto">
                {/* 标题栏 */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Server className="w-6 h-6 text-blue-500" />
                        <h1 className="text-xl font-bold text-gray-900 dark:text-base-content">
                            {t('nav.mcp')}
                        </h1>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({servers.length} {t('mcp.servers')})
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="px-3 py-1.5 bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-base-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {t('common.refresh')}
                        </button>
                        <button
                            onClick={handleAdd}
                            className="px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            {t('common.add')}
                        </button>
                    </div>
                </div>

                {/* 服务器列表 */}
                {loading ? (
                    <div className="bg-white dark:bg-base-100 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-base-200 text-center">
                        <RefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
                        <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
                    </div>
                ) : servers.length === 0 ? (
                    <div className="bg-white dark:bg-base-100 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-base-200 text-center">
                        <Server className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">{t('mcp.empty')}</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('mcp.empty_hint')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {servers.map((server) => (
                            <div
                                key={server.id}
                                className="bg-white dark:bg-base-100 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-base-200 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-semibold text-gray-900 dark:text-base-content">
                                                {server.name}
                                            </h3>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                server.source === 'global'
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            }`}>
                                                {server.source === 'global' ? (
                                                    <span className="flex items-center gap-1">
                                                        <Globe className="w-3 h-3" />
                                                        {t('mcp.global')}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1">
                                                        <Folder className="w-3 h-3" />
                                                        {t('mcp.project')}
                                                    </span>
                                                )}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                server.transport === 'stdio'
                                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                                            }`}>
                                                {server.transport.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            {server.command && (
                                                <p className="text-gray-600 dark:text-gray-400">
                                                    <span className="font-medium">{t('mcp.command')}:</span> {server.command}
                                                </p>
                                            )}
                                            {server.url && (
                                                <p className="text-gray-600 dark:text-gray-400">
                                                    <span className="font-medium">{t('mcp.url')}:</span> {server.url}
                                                </p>
                                            )}
                                            {server.args && server.args.length > 0 && (
                                                <p className="text-gray-600 dark:text-gray-400">
                                                    <span className="font-medium">{t('mcp.args')}:</span> {server.args.join(' ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => handleEdit(server)}
                                            className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(server.name, server.source === 'global')}
                                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 添加/编辑对话框 */}
                <McpEditDialog
                    isOpen={isDialogOpen}
                    server={editingServer}
                    onClose={() => setIsDialogOpen(false)}
                    onSave={handleSave}
                />

                {/* 删除确认对话框 */}
                <ModalDialog
                    isOpen={deleteModal.isOpen}
                    title={t('mcp.delete_title')}
                    message={t('mcp.confirm_delete')}
                    type="confirm"
                    isDestructive={true}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleteModal({ isOpen: false, serverName: '', isGlobal: false })}
                />
            </div>
        </div>
    );
}

export default McpPage;
