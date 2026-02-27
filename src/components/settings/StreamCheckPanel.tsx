import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface StreamCheckResult {
    model: string;
    available: boolean;
    latencyMs: number;
    error: string | null;
}

function StreamCheckPanel() {
    const { t } = useTranslation();
    const [url, setUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<StreamCheckResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCheck = async () => {
        if (!url || !model) return;
        setLoading(true);
        setResult(null);
        setError(null);
        try {
            const res = await invoke<StreamCheckResult>('check_stream_connectivity', { url, apiKey, model });
            setResult(res);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200">
            <h2 className="font-semibold text-gray-900 dark:text-base-content mb-4">
                {t('settings.streamCheck')}
            </h2>
            <div className="space-y-3">
                <input
                    type="text"
                    placeholder={t('settings.endpointUrl')}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="input input-bordered input-sm w-full bg-gray-50 dark:bg-base-200"
                />
                <input
                    type="password"
                    placeholder={t('settings.apiKey')}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="input input-bordered input-sm w-full bg-gray-50 dark:bg-base-200"
                />
                <input
                    type="text"
                    placeholder={t('settings.modelName')}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="input input-bordered input-sm w-full bg-gray-50 dark:bg-base-200"
                />
                <button
                    onClick={handleCheck}
                    disabled={loading || !url || !model}
                    className="btn btn-sm bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-base-300"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                    {t('settings.checkStream')}
                </button>
                {result && (
                    <div className="text-sm bg-gray-50 dark:bg-base-200 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${result.available ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="text-gray-700 dark:text-gray-300">
                                {result.model}: {result.available ? t('settings.available') : t('settings.unavailable')}
                            </span>
                        </div>
                        <div className="text-gray-500">{t('settings.latency')}: {result.latencyMs}ms</div>
                        {result.error && <div className="text-red-500 text-xs break-all">{result.error}</div>}
                    </div>
                )}
                {error && <div className="text-sm text-red-500">{error}</div>}
            </div>
        </div>
    );
}

export default StreamCheckPanel;
