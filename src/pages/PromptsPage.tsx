import { useTranslation } from 'react-i18next';
import { FileText, Plus, RefreshCw, Trash2, Edit, Eye, Send } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePromptStore } from '../stores/usePromptStore';
import ModalDialog from '../components/common/ModalDialog';
import { showToast } from '../components/common/ToastContainer';
import { APP_TYPES, APP_LABELS, APP_COLORS, AppType } from '../types/app';

// 每个 prompt 的同步状态
type SyncStatusMap = Record<string, AppType[]>;

function PromptsPage() {
    const { t } = useTranslation();
    const { prompts, loading, loadPrompts, savePrompt, deletePrompt } = usePromptStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editContent, setEditContent] = useState('');
    const [previewName, setPreviewName] = useState<string | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; name: string }>({
        isOpen: false,
        name: ''
    });

    // 同步功能状态
    const [syncStatusMap, setSyncStatusMap] = useState<SyncStatusMap>({});
    const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});
    const [syncPanelName, setSyncPanelName] = useState<string | null>(null);

    useEffect(() => {
        loadPrompts();
    }, [loadPrompts]);

    // 加载各 prompt 的同步状态
    const loadSyncStatuses = useCallback(async (promptNames: string[]) => {
        const newStatus: SyncStatusMap = {};
        await Promise.all(
            promptNames.map(async (name) => {
                try {
                    const synced = await invoke<string[]>('get_prompt_sync_status', { name });
                    newStatus[name] = synced as AppType[];
                } catch {
                    newStatus[name] = [];
                }
            })
        );
        setSyncStatusMap(newStatus);
    }, []);

    useEffect(() => {
        if (prompts.length > 0) {
            loadSyncStatuses(prompts.map(p => p.name));
        }
    }, [prompts, loadSyncStatuses]);

    const handleAdd = () => {
        setEditName('');
        setEditContent('');
        setIsEditing(true);
    };

    const handleEdit = (name: string, content: string) => {
        setEditName(name);
        setEditContent(content);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!editName.trim()) return;
        try {
            await savePrompt(editName.trim(), editContent);
            setIsEditing(false);
        } catch (error) {
            console.error('保存失败:', error);
        }
    };

    const handleDelete = async (name: string) => {
        setDeleteModal({ isOpen: true, name });
    };

    const confirmDelete = async () => {
        try {
            await deletePrompt(deleteModal.name);
            showToast(t('prompts.delete_success'), 'success');
        } catch (error) {
            showToast(t('prompts.delete_failed'), 'error');
        } finally {
            setDeleteModal({ isOpen: false, name: '' });
        }
    };

    // 同步 prompt 到指定应用
    const handleSyncToApp = async (promptName: string, app: AppType) => {
        const key = `${promptName}-${app}`;
        setSyncingMap(prev => ({ ...prev, [key]: true }));
        try {
            await invoke('sync_prompt_to_app', { name: promptName, app });
            showToast(
                t('prompts.sync_success', '已同步到 {{app}}', { app: APP_LABELS[app] }),
                'success'
            );
            // 刷新该 prompt 的同步状态
            const synced = await invoke<string[]>('get_prompt_sync_status', { name: promptName });
            setSyncStatusMap(prev => ({ ...prev, [promptName]: synced as AppType[] }));
        } catch (error) {
            showToast(t('prompts.sync_failed', '同步失败: ') + error, 'error');
        } finally {
            setSyncingMap(prev => ({ ...prev, [key]: false }));
        }
    };

    if (isEditing) {
        return (
            <div className="h-full w-full overflow-y-auto">
                <div className="p-6 space-y-4 max-w-7xl mx-auto">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-base-content">
                            {editName ? t('prompts.edit') : t('prompts.add')}
                        </h1>
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-base-100 transition-colors">
                                {t('common.cancel')}
                            </button>
                            <button onClick={handleSave} className="px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors">
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t('prompts.name_placeholder')}
                        className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content"
                    />
                    <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={20}
                        placeholder={t('prompts.content_placeholder')}
                        className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content font-mono text-sm"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-6 space-y-4 max-w-7xl mx-auto">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-green-500" />
                        <h1 className="text-xl font-bold text-gray-900 dark:text-base-content">
                            {t('prompts.title')}
                        </h1>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {prompts.length} {t('prompts.presets')}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => loadPrompts()} disabled={loading} className="px-3 py-1.5 bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-base-100 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {t('common.refresh')}
                        </button>
                        <button onClick={handleAdd} className="px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1.5">
                            <Plus className="w-4 h-4" />
                            {t('common.add')}
                        </button>
                    </div>
                </div>

                {prompts.length === 0 ? (
                    <div className="bg-white dark:bg-base-100 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-base-200 text-center">
                        <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">{t('prompts.empty')}</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('prompts.empty_hint')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {prompts.map((prompt) => {
                            const syncedApps = syncStatusMap[prompt.name] ?? [];
                            const isSyncOpen = syncPanelName === prompt.name;
                            return (
                                <div key={prompt.name} className="bg-white dark:bg-base-100 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-base-200">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold text-gray-900 dark:text-base-content">{prompt.name}</h3>
                                                {/* 已同步应用 badge */}
                                                {syncedApps.length > 0 && (
                                                    <div className="flex gap-1 flex-wrap">
                                                        {syncedApps.map((app) => (
                                                            <span
                                                                key={app}
                                                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white"
                                                                style={{ backgroundColor: APP_COLORS[app] }}
                                                                title={APP_LABELS[app]}
                                                            >
                                                                {APP_LABELS[app]}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 font-mono">
                                                {prompt.content.substring(0, 200)}...
                                            </p>
                                        </div>
                                        <div className="flex gap-2 ml-4 flex-shrink-0">
                                            <button
                                                onClick={() => setPreviewName(previewName === prompt.name ? null : prompt.name)}
                                                className="p-2 text-gray-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                title={t('common.preview', '预览')}
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(prompt.name, prompt.content)}
                                                className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title={t('common.edit', '编辑')}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setSyncPanelName(isSyncOpen ? null : prompt.name)}
                                                className={`p-2 rounded-lg transition-colors ${
                                                    isSyncOpen
                                                        ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                                        : 'text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                                                }`}
                                                title={t('prompts.sync_to_app', '同步到应用')}
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(prompt.name)}
                                                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title={t('common.delete', '删除')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 预览内容 */}
                                    {previewName === prompt.name && (
                                        <pre className="mt-3 p-3 bg-gray-50 dark:bg-base-200 rounded-lg text-sm text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                                            {prompt.content}
                                        </pre>
                                    )}

                                    {/* 同步应用面板 */}
                                    {isSyncOpen && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-base-200">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                {t('prompts.sync_hint', '选择要同步到的应用（写入 ~/.{app}/prompts/{name}.md）')}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {APP_TYPES.map((app) => {
                                                    const isSynced = syncedApps.includes(app);
                                                    const key = `${prompt.name}-${app}`;
                                                    const isSyncing = !!syncingMap[key];
                                                    return (
                                                        <button
                                                            key={app}
                                                            type="button"
                                                            onClick={() => handleSyncToApp(prompt.name, app)}
                                                            disabled={isSyncing}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                                                                isSynced
                                                                    ? 'text-white border-transparent'
                                                                    : 'bg-gray-100 dark:bg-base-200 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-base-300 hover:border-gray-400'
                                                            }`}
                                                            style={isSynced ? { backgroundColor: APP_COLORS[app] } : undefined}
                                                            title={isSynced ? t('prompts.already_synced', '已同步，点击重新同步') : t('prompts.click_to_sync', '点击同步')}
                                                        >
                                                            {isSyncing ? (
                                                                <span className="loading loading-spinner loading-xs" />
                                                            ) : (
                                                                <span
                                                                    className={`w-2 h-2 rounded-full ${isSynced ? 'bg-white/70' : 'bg-gray-400'}`}
                                                                />
                                                            )}
                                                            {APP_LABELS[app]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 删除确认对话框 */}
                <ModalDialog
                    isOpen={deleteModal.isOpen}
                    title={t('prompts.delete_title')}
                    message={t('prompts.confirm_delete')}
                    type="confirm"
                    isDestructive={true}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleteModal({ isOpen: false, name: '' })}
                />
            </div>
        </div>
    );
}

export default PromptsPage;
