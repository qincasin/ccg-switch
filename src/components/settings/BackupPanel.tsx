import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Loader2, Trash2, Edit3, RotateCcw, Check, X, HardDrive } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import {
    listDbBackups, createDbBackup, restoreDbBackup,
    deleteDbBackup, renameDbBackup, getBackupSettings, saveBackupSettings
} from '../../services/advancedService';
import { BackupEntry, BackupSettings } from '../../types/advanced';

function BackupPanel() {
    const { t } = useTranslation();
    const [backups, setBackups] = useState<BackupEntry[]>([]);
    const [settings, setSettings] = useState<BackupSettings>({ intervalHours: 24, retainCount: 10 });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [editingName, setEditingName] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [confirmModal, setConfirmModal] = useState<{ type: 'restore' | 'delete'; filename: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => setMessage(null), 3000);
        return () => clearTimeout(timer);
    }, [message]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [backupList, backupSettings] = await Promise.all([
                listDbBackups(),
                getBackupSettings()
            ]);
            setBackups(backupList);
            setSettings(backupSettings);
        } catch (e) {
            setMessage({ type: 'error', text: String(e) });
        } finally {
            setLoading(false);
        }
    };

    const handleBackupNow = async () => {
        setActionLoading('backup');
        try {
            await createDbBackup();
            const list = await listDbBackups();
            setBackups(list);
            setMessage({ type: 'success', text: t('settings.backup.backupSuccess') });
        } catch (e) {
            setMessage({ type: 'error', text: t('settings.backup.operationFailed') + ': ' + String(e) });
        } finally {
            setActionLoading(null);
        }
    };

    const handleSettingsChange = async (newSettings: BackupSettings) => {
        setSettings(newSettings);
        try {
            await saveBackupSettings(newSettings);
        } catch (e) {
            setMessage({ type: 'error', text: t('settings.backup.operationFailed') + ': ' + String(e) });
        }
    };

    const handleConfirmAction = async () => {
        if (!confirmModal) return;
        const { type, filename } = confirmModal;
        setConfirmModal(null);
        setActionLoading(type);
        try {
            if (type === 'restore') {
                const safetyFile = await restoreDbBackup(filename);
                setMessage({ type: 'success', text: t('settings.backup.restoreSuccess', { filename: safetyFile }) });
            } else {
                await deleteDbBackup(filename);
                setMessage({ type: 'success', text: t('settings.backup.deleteSuccess') });
            }
            const list = await listDbBackups();
            setBackups(list);
        } catch (e) {
            setMessage({ type: 'error', text: t('settings.backup.operationFailed') + ': ' + String(e) });
        } finally {
            setActionLoading(null);
        }
    };

    const handleRenameStart = (filename: string) => {
        setEditingName(filename);
        setNewName(filename);
    };

    const handleRenameConfirm = async () => {
        if (!editingName || !newName.trim() || newName === editingName) {
            setEditingName(null);
            return;
        }
        setActionLoading('rename');
        try {
            await renameDbBackup(editingName, newName.trim());
            const list = await listDbBackups();
            setBackups(list);
            setMessage({ type: 'success', text: t('settings.backup.renameSuccess') });
        } catch (e) {
            setMessage({ type: 'error', text: t('settings.backup.operationFailed') + ': ' + String(e) });
        } finally {
            setEditingName(null);
            setActionLoading(null);
        }
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRenameConfirm();
        } else if (e.key === 'Escape') {
            setEditingName(null);
        }
    };

    const formatSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDate = (iso: string): string => {
        try {
            return new Date(iso).toLocaleString();
        } catch {
            return iso;
        }
    };

    const intervalOptions = [
        { value: 0, key: 'off' },
        { value: 6, key: '6h' },
        { value: 12, key: '12h' },
        { value: 24, key: '24h' },
        { value: 48, key: '48h' },
        { value: 168, key: '168h' },
    ];

    const retainOptions = [3, 5, 10, 20, 50];

    return (
        <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200">
            <h2 className="font-semibold text-gray-900 dark:text-base-content flex items-center gap-2 mb-4">
                <Database className="w-4 h-4" />
                {t('settings.backup.title')}
            </h2>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('settings.backup.interval')}</label>
                    <select
                        value={settings.intervalHours}
                        onChange={(e) => handleSettingsChange({ ...settings, intervalHours: Number(e.target.value) })}
                        className="select select-bordered select-sm w-full bg-gray-50 dark:bg-base-200"
                    >
                        {intervalOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {t(`settings.backup.intervalOptions.${opt.key}`)}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('settings.backup.retainCount')}</label>
                    <select
                        value={settings.retainCount}
                        onChange={(e) => handleSettingsChange({ ...settings, retainCount: Number(e.target.value) })}
                        className="select select-bordered select-sm w-full bg-gray-50 dark:bg-base-200"
                    >
                        {retainOptions.map(n => (
                            <option key={n} value={n}>
                                {t(`settings.backup.retainOptions.${n}`)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={handleBackupNow}
                    disabled={actionLoading === 'backup'}
                    className="btn btn-sm bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-base-300"
                >
                    {actionLoading === 'backup' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <HardDrive className="w-4 h-4" />
                    )}
                    {t('settings.backup.backupNow')}
                </button>
                <span className="text-xs text-gray-400">
                    {backups.length} {t('settings.backup.backupList')}
                </span>
            </div>

            {/* Backup list */}
            <div className="max-h-[300px] overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                ) : backups.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-4">
                        {t('settings.backup.empty')}
                    </div>
                ) : (
                    backups.map(backup => (
                        <div
                            key={backup.filename}
                            className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-base-200 last:border-b-0"
                        >
                            {editingName === backup.filename ? (
                                <div className="flex items-center gap-1 flex-1 mr-2">
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={handleRenameKeyDown}
                                        autoFocus
                                        className="input input-bordered input-xs flex-1 bg-gray-50 dark:bg-base-200"
                                    />
                                    <button
                                        onClick={handleRenameConfirm}
                                        disabled={actionLoading === 'rename'}
                                        className="btn btn-ghost btn-xs text-green-600"
                                    >
                                        {actionLoading === 'rename' ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Check className="w-3 h-3" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setEditingName(null)}
                                        className="btn btn-ghost btn-xs text-gray-400"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]" title={backup.filename}>
                                            {backup.filename}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {formatDate(backup.createdAt)} &middot; {formatSize(backup.sizeBytes)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <button
                                            onClick={() => handleRenameStart(backup.filename)}
                                            className="btn btn-ghost btn-xs"
                                            title={t('settings.backup.rename')}
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setConfirmModal({ type: 'restore', filename: backup.filename })}
                                            disabled={actionLoading === 'restore'}
                                            className="btn btn-ghost btn-xs"
                                            title={t('settings.backup.restore')}
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setConfirmModal({ type: 'delete', filename: backup.filename })}
                                            disabled={actionLoading === 'delete'}
                                            className="btn btn-ghost btn-xs text-red-500"
                                            title={t('settings.backup.delete')}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Message */}
            {message && (
                <div className={`text-sm mt-3 ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                    {message.text}
                </div>
            )}

            {/* Confirm modal */}
            <ModalDialog
                isOpen={!!confirmModal}
                title={confirmModal?.type === 'restore' ? t('settings.backup.confirmRestore') : t('settings.backup.confirmDelete')}
                message={confirmModal?.type === 'restore' ? t('settings.backup.confirmRestoreMsg') : t('settings.backup.confirmDeleteMsg')}
                type="confirm"
                isDestructive={confirmModal?.type === 'delete'}
                onConfirm={handleConfirmAction}
                onCancel={() => setConfirmModal(null)}
            />
        </div>
    );
}

export default BackupPanel;
