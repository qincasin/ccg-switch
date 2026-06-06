/**
 * 账号详情弹窗。
 * 包含账号信息、Token 状态、配额详情、操作历史、预热操作。
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ChevronDown, ChevronUp, Mail, Tag, Calendar, Clock, Shield, AlertTriangle, Activity, Power, Zap, Loader2, CheckCircle, XCircle, Thermometer } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import { AntigravityAccount, AgOperationLog, TokenStatus } from '../../types/antigravity';
import { useAntigravityStore } from '../../stores/useAntigravityStore';
import QuotaDisplay from './QuotaDisplay';

interface Props {
  account: AntigravityAccount;
  open: boolean;
  onClose: () => void;
}

export default function AccountDetailsDialog({ account, open, onClose }: Props) {
  const { t } = useTranslation();
  const { fetchQuota, getOperationLogs, getTokenStatus, warmupAccount } = useAntigravityStore();
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaExpanded, setQuotaExpanded] = useState(true);

  // Token status state
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [tokenStatusLoading, setTokenStatusLoading] = useState(false);
  const [tokenRefreshing, setTokenRefreshing] = useState(false);
  const [tokenExpanded, setTokenExpanded] = useState(true);

  // Operation history state
  const [operationLogs, setOperationLogs] = useState<AgOperationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(true);

  // Warmup state
  const [warmupLoading, setWarmupLoading] = useState(false);
  const [warmupResult, setWarmupResult] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadTokenStatus();
      loadOperationLogs();
      setWarmupResult(null);
    }
  }, [open, account.id]);

  const loadTokenStatus = async () => {
    setTokenStatusLoading(true);
    try {
      const status = await getTokenStatus(account.id);
      setTokenStatus(status);
    } catch {
      setTokenStatus(null);
    } finally {
      setTokenStatusLoading(false);
    }
  };

  const loadOperationLogs = async () => {
    setLogsLoading(true);
    try {
      const logs = await getOperationLogs(account.id, 20);
      setOperationLogs(logs);
    } catch {
      setOperationLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleRefreshQuota = async () => {
    setQuotaLoading(true);
    try {
      await fetchQuota(account.id);
    } finally {
      setQuotaLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    setTokenRefreshing(true);
    try {
      await useAntigravityStore.getState().refreshToken(account.id);
      await loadTokenStatus();
    } finally {
      setTokenRefreshing(false);
    }
  };

  const handleWarmup = async () => {
    setWarmupLoading(true);
    setWarmupResult(null);
    try {
      const result = await warmupAccount(account.id);
      setWarmupResult(result);
    } catch (e) {
      setWarmupResult(String(e));
    } finally {
      setWarmupLoading(false);
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString();
  };

  const formatRelativeTime = (ts: number) => {
    if (!ts) return '-';
    const now = Math.floor(Date.now() / 1000);
    const diff = now - ts;
    if (diff < 60) return t('antigravity.just_now');
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t('antigravity.minutes_ago')}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('antigravity.hours_ago')}`;
    return `${Math.floor(diff / 86400)} ${t('antigravity.days_ago')}`;
  };

  const formatExpiresIn = (seconds: number) => {
    if (seconds <= 0) return t('antigravity.token_expired');
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const tierBadge = () => {
    const tier = (account.subscriptionTier || 'FREE').toLowerCase();
    if (tier.includes('ultra')) {
      return <span className="badge badge-secondary badge-sm">ULTRA</span>;
    }
    if (tier.includes('pro')) {
      return <span className="badge badge-primary badge-sm">PRO</span>;
    }
    return <span className="badge badge-ghost badge-sm">FREE</span>;
  };

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'token_refresh': return RefreshCw;
      case 'account_switch': return Power;
      case 'quota_refresh': return Activity;
      case 'account_added': return Zap;
      case 'account_deleted': return XCircle;
      case 'account_toggled': return CheckCircle;
      case 'warmup': return Thermometer;
      default: return Activity;
    }
  };

  const getOperationBadgeColor = (operation: string) => {
    switch (operation) {
      case 'token_refresh': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      case 'account_switch': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
      case 'quota_refresh': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
      case 'account_added': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
      case 'account_deleted': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      case 'account_toggled': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
      case 'warmup': return 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getOperationLabel = (operation: string) => {
    switch (operation) {
      case 'token_refresh': return t('antigravity.op_token_refresh');
      case 'account_switch': return t('antigravity.op_account_switch');
      case 'quota_refresh': return t('antigravity.op_quota_refresh');
      case 'account_added': return t('antigravity.op_account_added');
      case 'account_deleted': return t('antigravity.op_account_deleted');
      case 'account_toggled': return t('antigravity.op_account_toggled');
      case 'warmup': return t('antigravity.op_warmup');
      return operation;
    }
  };

  return (
    <ModalDialog isOpen={open} onClose={onClose} onConfirm={onClose} title={account.customLabel || account.email} confirmText={t('common.cancel')} confirmClass="btn btn-ghost" maxWidthClass="max-w-4xl">
      <div className="space-y-5">
        {/* Account info grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-2.5">
            <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('antigravity.email')}</div>
              <div className="text-sm font-medium">{account.email}</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('antigravity.name')}</div>
              <div className="text-sm font-medium">{account.name || '-'}</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Tag className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('antigravity.tier')}</div>
              <div className="mt-0.5">{tierBadge()}</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-4 h-4 flex items-center justify-center mt-0.5 shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full ${
                account.disabled ? 'bg-red-400' :
                account.isActive ? 'bg-green-400' : 'bg-gray-300'
              }`} />
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('antigravity.status')}</div>
              <div className="mt-0.5">
                {account.disabled ? (
                  <span className="badge badge-error badge-sm">{t('antigravity.disabled')}</span>
                ) : account.isActive ? (
                  <span className="badge badge-success badge-sm">{t('antigravity.active')}</span>
                ) : (
                  <span className="badge badge-ghost badge-sm">{t('antigravity.inactive')}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('antigravity.created')}</div>
              <div className="text-sm font-medium text-xs">{formatTime(account.createdAt)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('antigravity.last_used')}</div>
              <div className="text-sm font-medium text-xs">{formatTime(account.lastUsed)}</div>
            </div>
          </div>
        </div>

        {account.disabledReason && (
          <div className="alert alert-warning text-sm gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {account.disabledReason}
          </div>
        )}

        {/* Token Status Section */}
        <div className="border-t border-gray-200 dark:border-base-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <button
              className="flex items-center gap-1.5 text-sm font-medium hover:text-base-content transition-colors"
              onClick={() => setTokenExpanded(!tokenExpanded)}
            >
              {tokenExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {t('antigravity.token_status')}
            </button>
            <button
              className="btn btn-xs btn-ghost gap-1.5"
              onClick={handleRefreshToken}
              disabled={tokenRefreshing}
            >
              <RefreshCw className={`w-3 h-3 ${tokenRefreshing ? 'animate-spin' : ''}`} />
              {t('antigravity.refresh_token_btn')}
            </button>
          </div>
          {tokenExpanded && (
            tokenStatusLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : tokenStatus ? (
              <div className="space-y-3">
                {/* Status badge */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('antigravity.status')}</span>
                  {tokenStatus.isValid ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                      <CheckCircle className="w-3 h-3" />
                      {t('antigravity.token_valid')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      <XCircle className="w-3 h-3" />
                      {t('antigravity.token_expired')}
                    </span>
                  )}
                </div>
                {/* Details grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 dark:bg-base-200 rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">{t('antigravity.expires_in')}</div>
                    <div className={`text-xs font-semibold ${tokenStatus.expiresInSeconds > 0 ? 'text-gray-700 dark:text-gray-200' : 'text-red-500'}`}>
                      {formatExpiresIn(tokenStatus.expiresInSeconds)}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-base-200 rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">{t('antigravity.last_refreshed')}</div>
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {formatRelativeTime(tokenStatus.lastRefreshed)}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-base-200 rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">{t('antigravity.refresh_count')}</div>
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {tokenStatus.refreshCount}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
                {t('antigravity.no_token_status')}
              </div>
            )
          )}
        </div>

        {/* Quota Section */}
        <div className="border-t border-gray-200 dark:border-base-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <button
              className="flex items-center gap-1.5 text-sm font-medium hover:text-base-content transition-colors"
              onClick={() => setQuotaExpanded(!quotaExpanded)}
            >
              {quotaExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {t('antigravity.quota')}
            </button>
            <button
              className="btn btn-xs btn-ghost gap-1.5"
              onClick={handleRefreshQuota}
              disabled={quotaLoading}
            >
              <RefreshCw className={`w-3 h-3 ${quotaLoading ? 'animate-spin' : ''}`} />
              {t('antigravity.refresh_quota')}
            </button>
          </div>
          {quotaExpanded && account.quota && <QuotaDisplay models={account.quota.models} />}
          {quotaExpanded && !account.quota && (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
              {t('antigravity.no_quota_data')}
            </div>
          )}
        </div>

        {/* Operation History Section */}
        <div className="border-t border-gray-200 dark:border-base-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <button
              className="flex items-center gap-1.5 text-sm font-medium hover:text-base-content transition-colors"
              onClick={() => setHistoryExpanded(!historyExpanded)}
            >
              {historyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {t('antigravity.operation_history')}
            </button>
            <button
              className="btn btn-xs btn-ghost gap-1.5"
              onClick={loadOperationLogs}
              disabled={logsLoading}
            >
              <RefreshCw className={`w-3 h-3 ${logsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {historyExpanded && (
            logsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : operationLogs.length === 0 ? (
              <div className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
                {t('antigravity.no_history')}
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {operationLogs.map((log) => {
                  const Icon = getOperationIcon(log.operation);
                  return (
                    <div key={log.id} className="flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-base-200/50 transition-colors">
                      <div className={`shrink-0 mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${getOperationBadgeColor(log.operation)}`}>
                        <Icon className="w-2.5 h-2.5" />
                        {getOperationLabel(log.operation)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {log.detail && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={log.detail}>
                            {log.detail}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">
                        {formatRelativeTime(log.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Warmup Section */}
        <div className="border-t border-gray-200 dark:border-base-200 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Thermometer className="w-4 h-4 text-orange-500" />
              {t('antigravity.warmup')}
            </div>
            <button
              className="btn btn-xs bg-gradient-to-r from-orange-500 to-pink-500 text-white border-none gap-1.5 hover:from-orange-600 hover:to-pink-600"
              onClick={handleWarmup}
              disabled={warmupLoading}
            >
              {warmupLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Zap className="w-3 h-3" />
              )}
              {t('antigravity.warmup')}
            </button>
          </div>
          {warmupResult && (
            <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${
              warmupResult.includes('fail') || warmupResult.includes('error')
                ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
            }`}>
              {warmupResult}
            </div>
          )}
        </div>
      </div>
    </ModalDialog>
  );
}
