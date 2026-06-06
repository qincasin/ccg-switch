/**
 * Antigravity 账号卡片组件。
 * 显示账号头像、状态、配额预览、操作按钮（切换/刷新/删除/编辑标签/导出）。
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, RefreshCw, Eye, Zap, Power, Mail, Clock, CheckSquare, Square, AlertTriangle, ArrowRightLeft, Repeat2, Lock, Tag, X, Check, Download } from 'lucide-react';
import { showToast, dismissToast } from '../common/ToastContainer';
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
  const { deleteAccount, fetchQuota, switchAccount, toggleAccount, getTokenStatus, updateLabel, exportAccounts } = useAntigravityStore();
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [switchingTarget, setSwitchingTarget] = useState<'antigravity' | 'ide' | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(account.customLabel || '');
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
      await fetchQuota(account.id);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      await deleteAccount(account.id);
    } catch (e) {
      showToast(String(e), "error");
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); };
  }, []);

  // Sync label input when external data changes
  useEffect(() => {
    if (!isEditingLabel) setLabelInput(account.customLabel || '');
  }, [account.customLabel, isEditingLabel]);

  const handleSwitch = async (targetIde?: string) => {
    const target: 'ide' | 'antigravity' = targetIde ? 'ide' : 'antigravity';
    setSwitchingTarget(target);
    const label = targetIde ? 'Antigravity IDE' : 'Antigravity';
    const progressToastId = showToast(t('antigravity.switching_to', { target: label }), 'info', 30000);
    try {
      await switchAccount(account.id, targetIde);
      dismissToast(progressToastId);
      showToast(t('antigravity.switch_success', { target: label }), 'success', 3000);
    } catch (e) {
      dismissToast(progressToastId);
      showToast(String(e), 'error', 8000);
    } finally {
      setSwitchingTarget(null);
    }
  };

  const handleToggle = async () => {
    try {
      await toggleAccount(account.id, account.disabled);
    } catch (e) {
      showToast(String(e), "error");
    }
  };

  const handleSaveLabel = async () => {
    const trimmed = labelInput.trim();
    if (trimmed !== (account.customLabel || '')) {
      try {
        await updateLabel(account.id, trimmed || null);
      } catch (e) {
        showToast(String(e), "error");
      }
    }
    setIsEditingLabel(false);
  };

  const handleCancelLabel = () => {
    setLabelInput(account.customLabel || '');
    setIsEditingLabel(false);
  };

  const handleExport = async () => {
    try {
      const pairs = await exportAccounts([account.id]);
      const text = JSON.stringify(Object.fromEntries(pairs), null, 2);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `antigravity_${account.email}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(String(e), "error");
    }
  };

  const tierBadge = () => {
    const tier = (account.subscriptionTier || 'FREE').toLowerCase();
    if (tier.includes('ultra')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
          ULTRA
        </span>
      );
    }
    if (tier.includes('pro')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          PRO
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
                style={{ width: `${Math.max(0, Math.min(100, m.percentage))}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10 text-right">
              {m.percentage}%
            </span>
          </div>
        ))}
        {account.quota.models.length > 3 && (
          <button
            className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 pl-2.5 font-medium cursor-pointer hover:underline"
            onClick={(e) => { e.stopPropagation(); onViewDetails(account); }}
          >
            +{account.quota.models.length - 3} {t('antigravity.more_models')}
          </button>
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

      <div className="p-4">
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
          {/* Status badges */}
          <div className="flex items-center gap-1 shrink-0">
            {account.isActive && (
              <span className="badge badge-sm bg-gradient-to-r from-orange-500 to-pink-500 text-white border-none gap-1">
                <Zap className="w-3 h-3" fill="currentColor" />
                {t('antigravity.active')}
              </span>
            )}
            {account.disabled && (
              <span className="badge badge-error badge-sm">
                {t('antigravity.disabled')}
              </span>
            )}
            {account.quota?.isForbidden && (
              <span className="badge badge-sm bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-none gap-0.5">
                <Lock className="w-2.5 h-2.5" />
                FORBIDDEN
              </span>
            )}
            {account.customLabel && !isEditingLabel && (
              <span className="badge badge-sm bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-none gap-0.5">
                <Tag className="w-2.5 h-2.5" />
                {account.customLabel}
              </span>
            )}
          </div>
        </div>

        {/* Label edit overlay */}
        {isEditingLabel && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              className="flex-1 px-2 py-1 text-sm border border-orange-300 dark:border-orange-700 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-base-200"
              placeholder="Enter label..."
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveLabel();
                if (e.key === 'Escape') handleCancelLabel();
              }}
              autoFocus
              maxLength={15}
            />
            <button className="p-1 text-green-600 hover:bg-green-50 rounded" onClick={handleSaveLabel}>
              <Check className="w-4 h-4" />
            </button>
            <button className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded" onClick={handleCancelLabel}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quota preview */}
        {quotaSummary()}

        {/* Last used */}
        {formatLastUsed(account.lastUsed) && (
          <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatLastUsed(account.lastUsed)}
          </div>
        )}

        {/* Actions - icon-only buttons */}
        <div className="flex items-center justify-center gap-0.5 mt-3 pt-2.5 border-t border-gray-100 dark:border-base-200">
          <button
            className={`p-1.5 rounded-lg transition-all ${
              account.disabled
                ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'
            }`}
            onClick={handleToggle}
            title={account.disabled ? t('antigravity.enable') : t('antigravity.disable')}
          >
            {account.disabled
              ? <Zap className="w-3.5 h-3.5" />
              : <Power className="w-3.5 h-3.5" />
            }
          </button>
          {!account.disabled && (
            <>
              <button
                className={`p-1.5 rounded-lg transition-all ${switchingTarget === 'antigravity' ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                onClick={() => handleSwitch()}
                disabled={switchingTarget !== null}
                title={t('antigravity.switch_antigravity')}
              >
                <ArrowRightLeft className={`w-3.5 h-3.5 ${switchingTarget === 'antigravity' ? 'animate-spin' : ''}`} />
              </button>
              <button
                className={`p-1.5 rounded-lg transition-all ${switchingTarget === 'ide' ? 'text-sky-500' : 'text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20'}`}
                onClick={() => handleSwitch('ide')}
                disabled={switchingTarget !== null}
                title={t('antigravity.switch_antigravity_ide')}
              >
                <Repeat2 className={`w-3.5 h-3.5 ${switchingTarget === 'ide' ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
          <button
            className={`p-1.5 rounded-lg transition-all ${refreshing ? 'text-green-500' : 'text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
            onClick={handleRefresh}
            disabled={refreshing}
            title={t('antigravity.refresh_quota')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="p-1.5 text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-all"
            onClick={() => setIsEditingLabel(true)}
            title={t('antigravity.edit_label')}
          >
            <Tag className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
            onClick={() => onViewDetails(account)}
            title={t('antigravity.view_details')}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all"
            onClick={handleExport}
            title={t('antigravity.export')}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            className={`p-1.5 rounded-lg transition-all ${confirmDelete ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
            onClick={handleDelete}
            title={confirmDelete ? t('common.confirm') : t('common.delete')}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmDelete && <span className="text-[10px] ml-0.5">{t('common.confirm')}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
