import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface EnvIssue {
    variable: string;
    currentValue: string;
    source: string;
    severity: string;
    suggestion: string;
}

function EnvCheckerPanel() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [issues, setIssues] = useState<EnvIssue[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCheck = async () => {
        setLoading(true);
        setIssues(null);
        setError(null);
        try {
            const res = await invoke<EnvIssue[]>('check_env');
            setIssues(res);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'high':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'medium':
                return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            case 'low':
                return <Info className="w-4 h-4 text-blue-500" />;
            default:
                return <Info className="w-4 h-4 text-gray-400" />;
        }
    };

    const getSeverityBg = (severity: string) => {
        switch (severity) {
            case 'high':
                return 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950';
            case 'medium':
                return 'border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950';
            case 'low':
                return 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950';
            default:
                return 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-base-200';
        }
    };

    return (
        <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200">
            <h2 className="font-semibold text-gray-900 dark:text-base-content mb-4">
                {t('settings.envChecker')}
            </h2>
            <button
                onClick={handleCheck}
                disabled={loading}
                className="btn btn-sm bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-base-300"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {t('settings.checkEnv')}
            </button>
            {issues !== null && (
                <div className="mt-3 space-y-2">
                    {issues.length === 0 ? (
                        <div className="text-sm text-green-600">{t('settings.noIssues')}</div>
                    ) : (
                        issues.map((issue, idx) => (
                            <div key={idx} className={`text-sm rounded-lg p-3 border ${getSeverityBg(issue.severity)}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    {getSeverityIcon(issue.severity)}
                                    <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{issue.variable}</span>
                                    <span className="text-xs text-gray-400">({issue.severity})</span>
                                </div>
                                <div className="text-xs text-gray-500 font-mono mb-1">{issue.currentValue}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">{issue.suggestion}</div>
                            </div>
                        ))
                    )}
                </div>
            )}
            {error && <div className="mt-3 text-sm text-red-500">{error}</div>}
        </div>
    );
}

export default EnvCheckerPanel;
