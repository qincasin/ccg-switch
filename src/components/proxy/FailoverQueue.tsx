import { useEffect } from 'react';
import { GitMerge } from 'lucide-react';
import { useProviderStore } from '../../stores/useProviderStore';
import { showToast } from '../common/ToastContainer';

export default function FailoverQueue() {
    const { providers, hasLoaded, loading, loadAllProviders, updateProvider } = useProviderStore();

    useEffect(() => {
        if (!hasLoaded) {
            void loadAllProviders();
        }
    }, [hasLoaded, loadAllProviders]);

    const claudeProviders = providers.filter((p) => p.appType === 'claude');

    const handleToggle = async (id: string, current: boolean) => {
        try {
            await updateProvider(id, { inFailoverQueue: !current });
            showToast(
                !current ? '已加入故障转移队列' : '已移出故障转移队列',
                'success',
            );
        } catch (error) {
            showToast('更新失败: ' + String(error), 'error');
        }
    };

    const queueCount = claudeProviders.filter((p) => p.inFailoverQueue).length;

    return (
        <div className="bg-white dark:bg-base-100 rounded-xl shadow-sm border border-gray-100 dark:border-base-200 p-5">
            <div className="flex items-center gap-2 mb-4">
                <GitMerge className="w-4 h-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900 dark:text-base-content">故障转移队列</h2>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    {queueCount} / {claudeProviders.length} 已加入
                </span>
            </div>

            {claudeProviders.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                    暂无 Claude Provider
                </div>
            ) : (
                <div className="space-y-2">
                    {claudeProviders.map((provider) => (
                        <div
                            key={provider.id}
                            className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                                provider.inFailoverQueue
                                    ? 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800'
                                    : 'bg-gray-50 dark:bg-base-200/50 hover:bg-gray-100 dark:hover:bg-base-200'
                            }`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {provider.inFailoverQueue && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                )}
                                <span className={`text-sm font-medium truncate ${
                                    provider.inFailoverQueue
                                        ? 'text-blue-700 dark:text-blue-300'
                                        : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                    {provider.name}
                                </span>
                                {provider.isActive && (
                                    <span className="badge badge-xs badge-success shrink-0">Active</span>
                                )}
                            </div>
                            <input
                                type="checkbox"
                                checked={provider.inFailoverQueue}
                                onChange={() => void handleToggle(provider.id, provider.inFailoverQueue)}
                                disabled={loading}
                                className="checkbox checkbox-sm checkbox-primary disabled:opacity-50"
                            />
                        </div>
                    ))}
                </div>
            )}

            {claudeProviders.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                    勾选的 Provider 将参与自动故障转移
                </p>
            )}
        </div>
    );
}
