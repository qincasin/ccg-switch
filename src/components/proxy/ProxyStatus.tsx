import { useEffect } from 'react';
import { Power, Activity, RefreshCw } from 'lucide-react';
import { useProxyStore } from '../../stores/useProxyStore';
import { showToast } from '../common/ToastContainer';

export default function ProxyStatus() {
    const { proxyState, config, loading, loadStatus, startProxy, stopProxy } = useProxyStore();

    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    const running = proxyState?.running ?? false;

    const handleStart = async () => {
        try {
            await startProxy(config.host, config.port);
            showToast('代理服务已启动', 'success');
        } catch (error) {
            showToast('启动失败: ' + String(error), 'error');
        }
    };

    const handleStop = async () => {
        try {
            await stopProxy();
            showToast('代理服务已停止', 'info');
        } catch (error) {
            showToast('停止失败: ' + String(error), 'error');
        }
    };

    return (
        <div className="bg-white dark:bg-base-100 rounded-xl shadow-sm border border-gray-100 dark:border-base-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-base-content">代理状态</h2>
                <button
                    onClick={() => void loadStatus()}
                    disabled={loading}
                    className="btn btn-ghost btn-xs gap-1"
                    title="刷新状态"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* 状态指示器 */}
            <div className="flex items-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-colors ${
                    running
                        ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                        : 'bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700'
                }`}>
                    <Power className="w-7 h-7 text-white" />
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        <span className={`text-lg font-bold ${running ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {running ? '运行中' : '已停止'}
                        </span>
                    </div>
                    {running && proxyState && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-400">端口</span>
                                <code className="text-xs bg-gray-100 dark:bg-base-200 px-1.5 py-0.5 rounded font-mono">
                                    {proxyState.host}:{proxyState.port}
                                </code>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    已处理 <span className="font-semibold text-gray-700 dark:text-gray-200">{proxyState.requestCount}</span> 个请求
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
                {!running ? (
                    <button
                        onClick={() => void handleStart()}
                        disabled={loading}
                        className="flex-1 btn btn-success btn-sm gap-2"
                    >
                        {loading ? (
                            <span className="loading loading-spinner loading-xs" />
                        ) : (
                            <Power className="w-4 h-4" />
                        )}
                        启动代理
                    </button>
                ) : (
                    <button
                        onClick={() => void handleStop()}
                        disabled={loading}
                        className="flex-1 btn btn-error btn-sm gap-2"
                    >
                        {loading ? (
                            <span className="loading loading-spinner loading-xs" />
                        ) : (
                            <Power className="w-4 h-4" />
                        )}
                        停止代理
                    </button>
                )}
            </div>
        </div>
    );
}
