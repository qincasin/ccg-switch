import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, RefreshCw, Eye, Power, Zap, Mail, Clock, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { AntigravityAccount, TokenStatus } from '../../types/antigravity';
import { useAntigravityStore } from '../../stores/useAntigravityStore';

interface Props {
  account: AntigravityAccount;
  onViewDetails: (account: AntigravityAccount) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export default function AccountCard({ account, onViewDetails, selectMode, selected, onToggleSelect }: Props) {
  const { t } = useTranslation();
  const { deleteAccount, refreshToken, switchAccount, toggleAccount, getTokenStatus } = useAntigravityStore();
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const status = await getTokenStatus(account.id);
        if (!cancelled) setTokenStatus(status);
      } catch {
        // Silently ignore - token status is optional
      }
    };
    fetchStatus();
    return () => { cancelled = true; };
  }, [account.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshToken(account.id);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await deleteAccount(account.id);
  };

  const handleSwitch = async () => {
    await switchAccount(account.id);
  };

  const handleToggle = async () => {
    await toggleAccount(account.id, account.disabled);
  };

  const tierBadge = () => {
    const tier = account.subscriptionTier || 'FREE';
    if (tier === 'PRO') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          PRO
        </span>
      );
    }
    if (tier === 'ULTRA') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
          ULTRA
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        FREE
      </span>
    );
  };

  const getBorderColor = (pct: number) => {
    if (pct >= 80) return 'border-l-green-500';
    if (pct >= 50) return 'border-l-yellow-500';
    if (pct >= 20) return 'border-l-orange-500';
    return 'border-l-red-500';
  };

  const quotaSummary = () => {
    if (!account.quota || account.quota.models.length === 0) return null;

    const models = account.quota.models.slice(0, 3);
    return (
      <div className="space-y-2.5 mt-3">
        {models.map((m) => (
          <div key={m.name} className={`flex items-center gap-2 border-l-[3px] pl-2.5 ${getBorderColor(m.percentage)}`}>
            <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[120px] truncate" title={m.displayName || m.name}>
              {m.displayName || m.name}
            </span>
            <div className="flex-1 h-2.5 bg-gray-100 dark:bg-base-300 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  m.percentage >= 80 ? 'bg-green-500' :
                  m.percentage >= 50 ? 'bg-yellow-500' :
                  m.percentage >= 20 ? 'bg-orange-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${m.percentage}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10 text-right">
              {m.percentage}%
            </span>
          </div>
        ))}
        {account.quota.models.length > 3 && (
          <div className="text-xs text-blue-500 dark:text-blue-400 pl-2.5 font-medium">
            +{account.quota.models.length - 3} {t('antigravity.more_models')}
          </div>
        )}
      </div>
    );
  };

  const formatLastUsed = (ts: number) => {
    if (!ts) return null;
    const now = Math.floor(Date.now() / 1000);
    const diff = now - ts;
    if (diff < 60) return t('antigravity.just_now');
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t('antigravity.minutes_ago')}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('antigravity.hours_ago')}`;
    return `${Math.floor(diff / 86400)} ${t('antigravity.days_ago')}`;
  };

  return (
    <div
      className={`
        group relative bg-white dark:bg-base-100 rounded-xl border shadow-sm transition-all duration-200
        hover:shadow-md
        ${account.isActive
          ? 'border-orange-400 dark:border-orange-500 ring-1 ring-orange-200 dark:ring-orange-800/50'
          : 'border-gray-100 dark:border-base-200 hover:border-gray-200 dark:hover:border-base-300'
        }
        ${account.disabled ? 'opacity-60' : ''}
        ${selectMode && selected ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}
      `}
    >
      {/* Active indicator bar */}
      {account.isActive && (
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-orange-500 to-pink-500" />
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Checkbox in select mode */}
            {selectMode && (
              <button
                className="shrink-0 mt-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(account.id);
                }}
              >
                {selected
                  ? <CheckSquare className="w-4 h-4 text-blue-500" />
                  : <Square className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                }
              </button>
            )}
            {/* Avatar / Status dot */}
            <div className="relative shrink-0">
              <div className={`
                w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold
                ${account.disabled
                  ? 'bg-red-50 text-red-400 dark:bg-red-900/20 dark:text-red-400'
                  : account.isActive
                    ? 'bg-gradient-to-br from-orange-500 to-pink-500 text-white'
                    : 'bg-gray-100 text-gray-400 dark:bg-base-200 dark:text-gray-500'
                }
              `}>
                {account.email.charAt(0).toUpperCase()}
              </div>
              <div className={`
                absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-base-100
                ${account.disabled
                  ? 'bg-red-400'
                  : account.isActive
                    ? 'bg-green-400'
                    : 'bg-gray-300 dark:bg-gray-600'
                }
              `} />
            </div>
            {/* Name and email */}
            <div className="min-w-0">
              <div className="font-medium text-sm truncate flex items-center gap-1.5">
                <span className="truncate">{account.customLabel || account.email}</span>
                {tierBadge()}
                {tokenStatus && !tokenStatus.isValid && (
                  <span title={t('antigravity.token_expired')}>
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 truncate flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{account.email}</span>
              </div>
            </div>
          </div>
          {/* Active badge */}
          {account.isActive && (
            <span className="badge badge-sm bg-gradient-to-r from-orange-500 to-pink-500 text-white border-none gap-1 shrink-0">
              <Zap className="w-3 h-3" fill="currentColor" />
              {t('antigravity.active')}
            </span>
          )}
          {account.disabled && (
            <span className="badge badge-error badge-sm shrink-0">
              {t('antigravity.disabled')}
            </span>
          )}
        </div>

        {/* Quota preview */}
        {quotaSummary()}

        {/* Last used */}
        {formatLastUsed(account.lastUsed) && (
          <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatLastUsed(account.lastUsed)}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50 dark:border-base-200">
          {/* Enable/disable toggle */}
          <button
            className={`btn btn-xs btn-ghost gap-1 ${account.disabled ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
            onClick={handleToggle}
            title={account.disabled ? t('antigravity.enable') : t('antigravity.disable')}
          >
            <Power className="w-3 h-3" />
            {account.disabled ? t('antigravity.enable') : t('antigravity.disable')}
          </button>
          {!account.disabled && !account.isActive && (
            <button
              className="btn btn-xs btn-ghost gap-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
              onClick={handleSwitch}
            >
              <Zap className="w-3 h-3" />
              {t('antigravity.switch')}
            </button>
          )}
          <div className="flex-1" />
          <button
            className="btn btn-xs btn-ghost gap-1"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="btn btn-xs btn-ghost gap-1"
            onClick={() => onViewDetails(account)}
          >
            <Eye className="w-3 h-3" />
          </button>
          <button
            className={`btn btn-xs btn-ghost gap-1 ${confirmDelete ? 'text-error' : 'text-gray-400 hover:text-red-500'}`}
            onClick={handleDelete}
          >
            <Trash2 className="w-3 h-3" />
            {confirmDelete && <span className="text-xs">{t('common.confirm')}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
