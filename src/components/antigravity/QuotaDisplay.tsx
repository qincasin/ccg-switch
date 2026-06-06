/**
 * 配额模型列表显示组件。
 * 每个模型显示名称、能力徽章（Thinking/Image/Recommended）、
 * 彩色进度条、thinking budget、最���输出 token、重置时间。
 */

import { useTranslation } from 'react-i18next';
import { Brain, Image, Star, RotateCcw } from 'lucide-react';
import { AntigravityModelQuota } from '../../types/antigravity';

interface Props {
  models: AntigravityModelQuota[];
}

export default function QuotaDisplay({ models }: Props) {
  const { t } = useTranslation();

  if (models.length === 0) {
    return <div className="text-sm text-gray-400 dark:text-gray-500">{t('antigravity.no_quota_data')}</div>;
  }

  const getBarColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    if (pct >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTextColor = (pct: number) => {
    if (pct >= 80) return 'text-green-600 dark:text-green-400';
    if (pct >= 50) return 'text-yellow-600 dark:text-yellow-400';
    if (pct >= 20) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getBorderColor = (pct: number) => {
    if (pct >= 80) return 'border-l-green-500';
    if (pct >= 50) return 'border-l-yellow-500';
    if (pct >= 20) return 'border-l-orange-500';
    return 'border-l-red-500';
  };

  const formatResetTime = (resetTime: string) => {
    if (!resetTime) return null;
    // resetTime may be an ISO string or a Unix timestamp string
    const date = new Date(resetTime);
    if (isNaN(date.getTime())) {
      // Try as unix timestamp (seconds)
      const asNumber = Number(resetTime);
      if (!isNaN(asNumber) && asNumber > 0) {
        const d = new Date(asNumber * 1000);
        if (!isNaN(d.getTime())) return d.toLocaleString();
      }
      return null;
    }
    return date.toLocaleString();
  };

  const formatTokenCount = (tokens?: number) => {
    if (!tokens) return null;
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(tokens % 1000 === 0 ? 0 : 1)}${t('antigravity.tokens')}`;
    }
    return `${tokens}`;
  };

  return (
    <div className="space-y-2.5">
      {models.map((m) => (
        <div
          key={m.name}
          className={`border-l-[3px] ${getBorderColor(m.percentage)} pl-3 pr-2 py-2 rounded-r-md hover:bg-gray-50 dark:hover:bg-base-200/50 transition-colors`}
        >
          {/* Row 1: Model name + badges + percentage */}
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate"
              title={m.displayName || m.name}
            >
              {m.displayName || m.name}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {m.recommended && (
                <span className="badge badge-xs badge-outline badge-warning gap-0.5" title={t('antigravity.recommended')}>
                  <Star className="w-2.5 h-2.5" fill="currentColor" />
                </span>
              )}
              {m.supportsThinking && (
                <span className="badge badge-xs badge-outline badge-info gap-0.5" title={t('antigravity.thinking')}>
                  <Brain className="w-2.5 h-2.5" />
                </span>
              )}
              {m.supportsImages && (
                <span className="badge badge-xs badge-outline badge-success gap-0.5" title={t('antigravity.images')}>
                  <Image className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            <div className="flex-1" />
            <span className={`text-xs font-semibold ${getTextColor(m.percentage)}`}>
              {m.percentage}%
            </span>
          </div>

          {/* Row 2: Progress bar */}
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="flex-1 h-2 bg-gray-100 dark:bg-base-300 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(m.percentage)}`}
                style={{ width: `${Math.max(0, Math.min(100, m.percentage))}%` }}
              />
            </div>
          </div>

          {/* Row 3: Meta info */}
          {(m.thinkingBudget || m.maxOutputTokens || m.resetTime) && (
            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 dark:text-gray-500 flex-wrap">
              {m.thinkingBudget != null && m.thinkingBudget > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Brain className="w-2.5 h-2.5" />
                  {t('antigravity.thinking_budget')}: {formatTokenCount(m.thinkingBudget)}
                </span>
              )}
              {m.maxOutputTokens != null && m.maxOutputTokens > 0 && (
                <span>
                  {t('antigravity.max_output')}: {formatTokenCount(m.maxOutputTokens)}
                </span>
              )}
              {formatResetTime(m.resetTime) && (
                <span className="inline-flex items-center gap-0.5">
                  <RotateCcw className="w-2.5 h-2.5" />
                  {formatResetTime(m.resetTime)}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
