import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface SpeedTestResult {
    url: string;
    latencyMs: number;
    status: string;
    timestamp: string;
}

function SpeedTestPanel() {
    const { t } = useTranslation();
    const [url, setUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SpeedTestResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleTest = async () => {
        if (!url) return;
        setLoading(true);
        setResult(null);
        setError(null);
        try {
            const res = await invoke<SpeedTestResult>('test_endpoint_speed', { url, apiKey });
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
                {t('settings.speedTest')}
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
                <button
                    onClick={handleTest}
                    disabled={loading || !url}
                    className="btn btn-sm bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-base-300"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {t('settings.testSpeed')}
                </button>
                {result && (
                    <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-base-200 rounded-lg p-3 space-y-1">
                        <div>{t('settings.latency')}: <span className="font-mono font-semibold">{result.latencyMs}ms</span></div>
                        <div>{t('settings.status')}: <span className="font-mono">{result.status}</span></div>
                    </div>
                )}
                {error && <div className="text-sm text-red-500">{error}</div>}
            </div>
        </div>
    );
}

export default SpeedTestPanel;
