import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { McpServerConfig } from '../../types/mcpV2';

interface McpWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (title: string, json: string) => void;
    initialTitle?: string;
    initialServer?: McpServerConfig;
}

// 解析环境变量文本为对象
const parseEnvText = (text: string): Record<string, string> => {
    const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    const env: Record<string, string> = {};
    for (const l of lines) {
        const idx = l.indexOf('=');
        if (idx > 0) {
            const k = l.slice(0, idx).trim();
            const v = l.slice(idx + 1).trim();
            if (k) env[k] = v;
        }
    }
    return env;
};

// 解析headers文本为对象（支持 KEY: VALUE 或 KEY=VALUE）
const parseHeadersText = (text: string): Record<string, string> => {
    const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    const headers: Record<string, string> = {};
    for (const l of lines) {
        const colonIdx = l.indexOf(':');
        const equalIdx = l.indexOf('=');
        let idx = -1;
        if (colonIdx > 0 && (equalIdx === -1 || colonIdx < equalIdx)) {
            idx = colonIdx;
        } else if (equalIdx > 0) {
            idx = equalIdx;
        }
        if (idx > 0) {
            const k = l.slice(0, idx).trim();
            const v = l.slice(idx + 1).trim();
            if (k) headers[k] = v;
        }
    }
    return headers;
};

function McpWizardModal({ isOpen, onClose, onApply, initialTitle, initialServer }: McpWizardModalProps) {
    const { t } = useTranslation();
    const [wizardType, setWizardType] = useState<'stdio' | 'http' | 'sse'>('stdio');
    const [wizardTitle, setWizardTitle] = useState('');
    // stdio 字段
    const [wizardCommand, setWizardCommand] = useState('');
    const [wizardArgs, setWizardArgs] = useState('');
    const [wizardEnv, setWizardEnv] = useState('');
    // http 和 sse 字段
    const [wizardUrl, setWizardUrl] = useState('');
    const [wizardHeaders, setWizardHeaders] = useState('');

    // 生成预览 JSON
    const generatePreview = (): string => {
        const config: McpServerConfig = {
            type: wizardType,
        };

        if (wizardType === 'stdio') {
            config.command = wizardCommand.trim();

            if (wizardArgs.trim()) {
                config.args = wizardArgs
                    .split('\n')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0);
            }

            if (wizardEnv.trim()) {
                const env = parseEnvText(wizardEnv);
                if (Object.keys(env).length > 0) {
                    config.env = env;
                }
            }
        } else {
            config.url = wizardUrl.trim();

            if (wizardHeaders.trim()) {
                const headers = parseHeadersText(wizardHeaders);
                if (Object.keys(headers).length > 0) {
                    (config as Record<string, unknown>).headers = headers;
                }
            }
        }

        return JSON.stringify(config, null, 2);
    };

    const handleApply = () => {
        if (!wizardTitle.trim()) {
            alert(t('mcp.error.idRequired'));
            return;
        }
        if (wizardType === 'stdio' && !wizardCommand.trim()) {
            alert(t('mcp.error.commandRequired'));
            return;
        }
        if ((wizardType === 'http' || wizardType === 'sse') && !wizardUrl.trim()) {
            alert(t('mcp.wizard.urlRequired'));
            return;
        }

        const json = generatePreview();
        onApply(wizardTitle.trim(), json);
        handleClose();
    };

    const handleClose = () => {
        setWizardType('stdio');
        setWizardTitle('');
        setWizardCommand('');
        setWizardArgs('');
        setWizardEnv('');
        setWizardUrl('');
        setWizardHeaders('');
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleApply();
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        setWizardTitle(initialTitle ?? '');

        const resolvedType = initialServer?.type as 'stdio' | 'http' | 'sse' ??
            (initialServer?.url ? 'http' : 'stdio');
        setWizardType(resolvedType);

        if (resolvedType === 'http' || resolvedType === 'sse') {
            setWizardUrl(initialServer?.url ?? '');
            const headers = (initialServer as Record<string, unknown>)?.headers;
            if (headers && typeof headers === 'object') {
                setWizardHeaders(
                    Object.entries(headers as Record<string, string>)
                        .map(([k, v]) => `${k}: ${v ?? ''}`)
                        .join('\n')
                );
            } else {
                setWizardHeaders('');
            }
            setWizardCommand('');
            setWizardArgs('');
            setWizardEnv('');
        } else {
            setWizardCommand(initialServer?.command ?? '');
            const argsValue = initialServer?.args;
            setWizardArgs(Array.isArray(argsValue) ? argsValue.join('\n') : '');
            const env = initialServer?.env;
            if (env && typeof env === 'object') {
                setWizardEnv(
                    Object.entries(env)
                        .map(([k, v]) => `${k}=${v ?? ''}`)
                        .join('\n')
                );
            } else {
                setWizardEnv('');
            }
            setWizardUrl('');
            setWizardHeaders('');
        }
    }, [isOpen, initialTitle, initialServer]);

    const preview = generatePreview();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onKeyDown={handleKeyDown}>
            <div className="bg-white dark:bg-base-100 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* 标题栏 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-base-200">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-base-content">
                        {t('mcp.wizard.title')}
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-base-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 表单内容 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* 提示 */}
                    <div className="rounded-lg border border-gray-200 dark:border-base-200 bg-gray-50 dark:bg-base-200 p-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('mcp.wizard.hint')}
                        </p>
                    </div>

                    {/* 类型选择 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('mcp.wizard.type')} <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="stdio"
                                    checked={wizardType === 'stdio'}
                                    onChange={(e) => setWizardType(e.target.value as 'stdio' | 'http' | 'sse')}
                                    className="radio radio-primary radio-sm"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {t('mcp.wizard.typeStdio')}
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="http"
                                    checked={wizardType === 'http'}
                                    onChange={(e) => setWizardType(e.target.value as 'stdio' | 'http' | 'sse')}
                                    className="radio radio-primary radio-sm"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {t('mcp.wizard.typeHttp')}
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="sse"
                                    checked={wizardType === 'sse'}
                                    onChange={(e) => setWizardType(e.target.value as 'stdio' | 'http' | 'sse')}
                                    className="radio radio-primary radio-sm"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {t('mcp.wizard.typeSse')}
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* 服务器 ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('mcp.form.title')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={wizardTitle}
                            onChange={(e) => setWizardTitle(e.target.value)}
                            placeholder={t('mcp.form.titlePlaceholder')}
                            className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content font-mono"
                        />
                    </div>

                    {/* Stdio 类型字段 */}
                    {wizardType === 'stdio' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('mcp.wizard.command')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={wizardCommand}
                                    onChange={(e) => setWizardCommand(e.target.value)}
                                    placeholder={t('mcp.wizard.commandPlaceholder')}
                                    className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('mcp.wizard.args')}
                                </label>
                                <textarea
                                    value={wizardArgs}
                                    onChange={(e) => setWizardArgs(e.target.value)}
                                    placeholder={t('mcp.wizard.argsPlaceholder')}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content font-mono text-sm resize-y"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('mcp.wizard.env')}
                                </label>
                                <textarea
                                    value={wizardEnv}
                                    onChange={(e) => setWizardEnv(e.target.value)}
                                    placeholder={t('mcp.wizard.envPlaceholder')}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content font-mono text-sm resize-y"
                                />
                            </div>
                        </>
                    )}

                    {/* HTTP 和 SSE 类型字段 */}
                    {(wizardType === 'http' || wizardType === 'sse') && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('mcp.wizard.url')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={wizardUrl}
                                    onChange={(e) => setWizardUrl(e.target.value)}
                                    placeholder={t('mcp.wizard.urlPlaceholder')}
                                    className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('mcp.wizard.headers')}
                                </label>
                                <textarea
                                    value={wizardHeaders}
                                    onChange={(e) => setWizardHeaders(e.target.value)}
                                    placeholder={t('mcp.wizard.headersPlaceholder')}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content font-mono text-sm resize-y"
                                />
                            </div>
                        </>
                    )}

                    {/* 配置预览 */}
                    {(wizardCommand || wizardArgs || wizardEnv || wizardUrl || wizardHeaders) && (
                        <div className="space-y-2 border-t border-gray-200 dark:border-base-200 pt-4">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('mcp.wizard.preview')}
                            </h3>
                            <pre className="overflow-x-auto rounded-lg bg-gray-100 dark:bg-base-200 p-3 text-xs font-mono text-gray-700 dark:text-gray-300">
                                {preview}
                            </pre>
                        </div>
                    )}
                </div>

                {/* 底部按钮 */}
                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-base-200">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-base-200 rounded-lg hover:bg-gray-200 dark:hover:bg-base-100 transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleApply}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                    >
                        {t('mcp.wizard.apply')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default McpWizardModal;
