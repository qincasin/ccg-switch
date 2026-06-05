import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Download, ArrowUpCircle, GitFork } from 'lucide-react';
import { useAboutStore } from '../../../stores/useAboutStore';
import { SourceUpdateInfo } from '../../../types/about';

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRepoName(repo: string): string {
    return repo.split('/')[0];
}

function UpdateBanner() {
    const { t } = useTranslation();
    const {
        updateInfo, sourceUpdates, downloading, downloadProgress, downloadedPath,
        installing, installStage, downloadUpdate, installUpdate, handleRelaunch,
    } = useAboutStore();

    const sourcesWithUpdate = sourceUpdates.filter(s => s.updateInfo.hasUpdate);
    const [selectedSource, setSelectedSource] = useState<string | null>(null);

    if (!updateInfo?.hasUpdate) return null;

    const activeSourceInfo: SourceUpdateInfo | undefined = selectedSource
        ? sourceUpdates.find(s => s.repo === selectedSource)
        : sourcesWithUpdate[0];

    const activeUpdateInfo = activeSourceInfo?.updateInfo || updateInfo;

    return (
        <div className="mt-4 rounded-lg border border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ArrowUpCircle className="w-4.5 h-4.5 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-base-content">
                        {t('settings.newVersionFound', { defaultValue: '发现新版本' })}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                        v{activeUpdateInfo.latestVersion}
                    </span>
                </div>
                {activeUpdateInfo.publishedAt && (
                    <span className="text-xs text-gray-400">
                        {new Date(activeUpdateInfo.publishedAt).toLocaleDateString()}
                    </span>
                )}
            </div>

            {/* 多源选择 */}
            {sourcesWithUpdate.length > 1 && (
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <GitFork className="w-3.5 h-3.5" />
                        {t('settings.selectUpdateSource', { defaultValue: '选择更新源' })}
                    </div>
                    <div className="flex gap-2">
                        {sourcesWithUpdate.map(s => (
                            <button
                                key={s.repo}
                                onClick={() => setSelectedSource(s.repo)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                    (selectedSource || sourcesWithUpdate[0]?.repo) === s.repo
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-white dark:bg-base-200 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-base-300 hover:bg-gray-50 dark:hover:bg-base-300'
                                }`}
                            >
                                {formatRepoName(s.repo)}
                                <span className="opacity-75">v{s.updateInfo.latestVersion}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Release Notes */}
            {activeUpdateInfo.releaseNotes && (
                <div className="text-xs text-gray-500 dark:text-gray-400 max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed bg-white/50 dark:bg-base-200/50 rounded-md p-2.5">
                    {activeUpdateInfo.releaseNotes}
                </div>
            )}

            {/* 下载进度条 */}
            {downloading && downloadProgress && (
                <div className="space-y-1.5">
                    <div className="w-full h-2 bg-gray-200 dark:bg-base-300 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                            style={{ width: `${downloadProgress.percentage}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400">
                        <span>{formatFileSize(downloadProgress.downloaded)} / {formatFileSize(downloadProgress.total)}</span>
                        <span>{downloadProgress.percentage.toFixed(0)}%</span>
                    </div>
                </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
                {!downloadedPath && !downloading && (
                    <button
                        onClick={() => downloadUpdate(activeUpdateInfo.downloadUrl!)}
                        disabled={!activeUpdateInfo.downloadUrl}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all shadow-sm disabled:opacity-60"
                    >
                        <Download className="w-3.5 h-3.5" />
                        {t('settings.downloadUpdate', { defaultValue: '下载更新' })}
                        {activeUpdateInfo.fileSize && (
                            <span className="opacity-75">({formatFileSize(activeUpdateInfo.fileSize)})</span>
                        )}
                    </button>
                )}
                {downloading && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-500">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {t('settings.downloading', { defaultValue: '下载中...' })}
                    </span>
                )}
                {downloadedPath && !installing && (
                    <button
                        onClick={() => installUpdate(downloadedPath)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all shadow-sm"
                    >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        {t('settings.installUpdate', { defaultValue: '安装更新' })}
                    </button>
                )}
                {installing && (
                    <>
                        {installStage === 'success' ? (
                            <button
                                onClick={handleRelaunch}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 transition-all shadow-sm"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                {t('settings.relaunchNow', { defaultValue: '立即重启' })}
                            </button>
                        ) : (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-500">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                {t(`settings.installStage.${installStage}`, { defaultValue: '正在启动安装程序...' })}
                            </span>
                        )}
                    </>
                )}
                {!activeUpdateInfo.downloadUrl && (
                    <span className="text-xs text-gray-400">
                        {t('settings.noInstallerFound', { defaultValue: '未找到当前平台的安装包' })}
                    </span>
                )}
            </div>
        </div>
    );
}

export default UpdateBanner;
