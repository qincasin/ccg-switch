import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { McpServer, McpApps, APP_KEYS, APP_LABELS } from '../../types/mcp';

interface McpEditDialogProps {
    isOpen: boolean;
    server: McpServer | null;
    onClose: () => void;
    onSave: (server: McpServer, isGlobal: boolean) => Promise<void>;
}

function McpEditDialog({ isOpen, server, onClose, onSave }: McpEditDialogProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<McpServer>>({
        name: '',
        transport: 'stdio',
        command: '',
        args: [],
        url: '',
        env: {},
        apps: {},
    });
    const [isGlobal, setIsGlobal] = useState(true);
    const [argsText, setArgsText] = useState('');
    const [envText, setEnvText] = useState('');
    const [appsState, setAppsState] = useState<McpApps>({});

    useEffect(() => {
        if (server) {
            setFormData({
                id: server.id,
                name: server.name,
                transport: server.transport,
                command: server.command,
                args: server.args,
                url: server.url,
                env: server.env,
            });
            setIsGlobal(server.source === 'global');
            setArgsText(server.args?.join('\n') || '');
            setEnvText(
                server.env
                    ? Object.entries(server.env)
                          .map(([key, value]) => `${key}=${value}`)
                          .join('\n')
                    : ''
            );
            setAppsState(server.apps ?? {});
        } else {
            setFormData({
                name: '',
                transport: 'stdio',
                command: '',
                args: [],
                url: '',
                env: {},
            });
            setIsGlobal(true);
            setArgsText('');
            setEnvText('');
            setAppsState({});
        }
    }, [server]);

    const getAppEnabled = (appKey: string): boolean => {
        if (Object.keys(appsState).length === 0) return true;
        return appsState[appKey] !== false;
    };

    const handleAppToggle = (appKey: string, enabled: boolean) => {
        setAppsState((prev) => ({ ...prev, [appKey]: enabled }));
    };

    const handleSave = async () => {
        if (!formData.name) {
            alert(t('mcp.error_name_required'));
            return;
        }

        // 解析参数
        const args = argsText
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line);

        // 解析环境变量
        const env: Record<string, string> = {};
        envText
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line)
            .forEach((line) => {
                const [key, ...valueParts] = line.split('=');
                if (key) {
                    env[key.trim()] = valueParts.join('=').trim();
                }
            });

        const newServer: McpServer = {
            id: formData.id || `mcp-${Date.now()}`,
            name: formData.name,
            transport: formData.transport || 'stdio',
            command: formData.command,
            args: args.length > 0 ? args : undefined,
            url: formData.url,
            env: Object.keys(env).length > 0 ? env : undefined,
            enabled: true,
            source: isGlobal ? 'global' : 'project',
            apps: appsState,
        };

        setLoading(true);
        try {
            await onSave(newServer, isGlobal);
            onClose();
        } catch (error) {
            console.error('保存 MCP 服务器失败:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-base-100 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* 标题栏 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-base-200">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-base-content">
                        {server ? t('mcp.edit_server') : t('mcp.add_server')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-base-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 表单内容 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* 服务器名称 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('mcp.server_name')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content"
                            placeholder={t('mcp.server_name_placeholder')}
                        />
                    </div>

                    {/* 配置级别 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('mcp.config_level')}
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={isGlobal}
                                    onChange={() => setIsGlobal(true)}
                                    className="radio radio-primary radio-sm"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {t('mcp.global')} (~/.claude.json)
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={!isGlobal}
                                    onChange={() => setIsGlobal(false)}
                                    className="radio radio-primary radio-sm"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {t('mcp.project')} (.mcp.json)
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* 传输类型 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('mcp.transport_type')}
                        </label>
                        <select
                            value={formData.transport || 'stdio'}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    transport: e.target.value as 'stdio' | 'http' | 'sse',
                                })
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content"
                        >
                            <option value="stdio">stdio</option>
                            <option value="http">http</option>
                            <option value="sse">sse</option>
                        </select>
                    </div>

                    {/* stdio 类型字段 */}
                    {formData.transport === 'stdio' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('mcp.command')}
                                </label>
                                <input
                                    type="text"
                                    value={formData.command || ''}
                                    onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content"
                                    placeholder="node"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('mcp.args')} <span className="text-xs text-gray-500">({t('mcp.args_hint')})</span>
                                </label>
                                <textarea
                                    value={argsText}
                                    onChange={(e) => setArgsText(e.target.value)}
                                    rows={4}
                                    className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content font-mono text-sm"
                                    placeholder="/path/to/server.js"
                                />
                            </div>
                        </>
                    )}

                    {/* http/sse 类型字段 */}
                    {(formData.transport === 'http' || formData.transport === 'sse') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('mcp.url')}
                            </label>
                            <input
                                type="text"
                                value={formData.url || ''}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content"
                                placeholder="http://localhost:3000"
                            />
                        </div>
                    )}

                    {/* 环境变量 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('mcp.env')} <span className="text-xs text-gray-500">({t('mcp.env_hint')})</span>
                        </label>
                        <textarea
                            value={envText}
                            onChange={(e) => setEnvText(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-base-content font-mono text-sm"
                            placeholder="API_KEY=your_key&#x0a;DEBUG=true"
                        />
                    </div>

                    {/* per-app 开关区域 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('mcp.app_switches')}
                        </label>
                        <div className="space-y-2 bg-gray-50 dark:bg-base-200 rounded-lg p-3">
                            {APP_KEYS.map((appKey) => (
                                <div key={appKey} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        {APP_LABELS[appKey]}
                                    </span>
                                    <input
                                        type="checkbox"
                                        className="toggle toggle-sm toggle-primary"
                                        checked={getAppEnabled(appKey)}
                                        onChange={(e) => handleAppToggle(appKey, e.target.checked)}
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {t('mcp.app_switches_hint')}
                        </p>
                    </div>
                </div>

                {/* 底部按钮 */}
                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-base-200">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-base-200 rounded-lg hover:bg-gray-200 dark:hover:bg-base-100 transition-colors disabled:opacity-50"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                {t('common.saving')}
                            </>
                        ) : (
                            t('common.save')
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default McpEditDialog;
