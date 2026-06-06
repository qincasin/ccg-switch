/**
 * Antigravity 账号管理主页面。
 * 包含统计栏、搜索筛选、账号卡片网格、批量操作、添加/详情弹窗。
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { showToast, dismissToast } from '../components/common/ToastContainer';
import { Plus, RefreshCw, Search, Shield, Loader2, Users, CheckCircle, XCircle, Activity, Crown, Download, CheckSquare, Trash2, Zap, LayoutGrid, List, ArrowRightLeft, Repeat2, Power, Tag, Eye, Square } from 'lucide-react';
import { useAntigravityStore } from '../stores/useAntigravityStore';
import { AntigravityAccount, TokenStatus } from '../types/antigravity';
import AccountCard from '../components/antigravity/AccountCard';
import AddAccountDialog from '../components/antigravity/AddAccountDialog';
import AccountDetailsDialog from '../components/antigravity/AccountDetailsDialog';

type TierFilter = 'all' | 'FREE' | 'PRO' | 'ULTRA';

function StatCard({
  icon: Icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  bgColor: string;
}) {
  return (
    <div className="bg-white dark:bg-base-100 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-base-200 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold text-gray-900 dark:text-base-content leading-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</div>
        </div>
      </div>
    </div>
  );
}

function AccountListRow({
  account,
  onViewDetails,
  selectMode,
  selected,
  onToggleSelect,
}: {
  account: AntigravityAccount;
  onViewDetails: (account: AntigravityAccount) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { deleteAccount, switchAccount, toggleAccount, fetchQuota, getTokenStatus, updateLabel } = useAntigravityStore();
  const [switchingTarget, setSwitchingTarget] = useState<'antigravity' | 'ide' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(account.customLabel || '');
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let cancelled = false;
    getTokenStatus(account.id).then(s => { if (!cancelled) setTokenStatus(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [account.id]);

  useEffect(() => { return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); }; }, []);

  useEffect(() => {
    let cancelled = false;
    getTokenStatus(account.id).then(s => { if (!cancelled) setTokenStatus(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [account.id]);

  useEffect(() => { return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); }; }, []);

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

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try { await deleteAccount(account.id); } catch (e) { showToast(String(e), 'error'); }
  };

  const handleSaveLabel = async () => {
    const trimmed = labelInput.trim();
    if (trimmed !== (account.customLabel || '')) {
      try { await updateLabel(account.id, trimmed || null); } catch (e) { showToast(String(e), 'error'); }
    }
    setIsEditingLabel(false);
  };

  const tier = (account.subscriptionTier || 'FREE').toLowerCase();
  const tierLabel = tier.includes('ultra') ? 'ULTRA' : tier.includes('pro') ? 'PRO' : 'FREE';

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all hover:shadow-sm ${
      account.isActive
        ? 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-300 dark:border-orange-700'
        : 'bg-white dark:bg-base-100 border-gray-100 dark:border-base-200'
    } ${account.disabled ? 'opacity-60' : ''} ${selectMode && selected ? 'ring-2 ring-blue-400' : ''}`}>
      {selectMode && (
        <button className="shrink-0" onClick={(e) => { e.stopPropagation(); onToggleSelect?.(account.id); }}>
          {selected ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4 text-gray-400" />}
        </button>
      )}
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
        account.disabled ? 'bg-red-50 text-red-400' : account.isActive ? 'bg-gradient-to-br from-orange-500 to-pink-500 text-white' : 'bg-gray-100 text-gray-400'
      }`}>{account.email.charAt(0).toUpperCase()}</div>
      {/* Info */}
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        {isEditingLabel ? (
          <input
            type="text"
            className="flex-1 px-2 py-0.5 text-sm border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white dark:bg-base-200 min-w-[120px]"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLabel(); if (e.key === 'Escape') { setLabelInput(account.customLabel || ''); setIsEditingLabel(false); } }}
            onBlur={handleSaveLabel}
            autoFocus
            maxLength={15}
          />
        ) : (
          <>
            <span className="font-medium text-sm truncate max-w-[200px]" title={account.email}>{account.customLabel || account.email}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              tier.includes('ultra') ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' :
              tier.includes('pro') ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' :
              'bg-gray-100 text-gray-500'
            }`}>{tierLabel}</span>
            {account.isActive && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-orange-500 to-pink-500 text-white">活跃</span>}
            {account.disabled && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">禁用</span>}
            {account.quota?.isForbidden && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">FORBIDDEN</span>}
            {account.customLabel && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">{account.customLabel}</span>}
            {tokenStatus && !tokenStatus.isValid && <span className="text-red-500 text-[10px]">Token过期</span>}
          </>
        )}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {!account.disabled && (
          <>
            <button className="p-1 text-gray-400 hover:text-blue-500 rounded" onClick={() => handleSwitch()} disabled={switchingTarget !== null} title="切换 Antigravity">
              <ArrowRightLeft className={`w-3.5 h-3.5 ${switchingTarget === 'antigravity' ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            <button className="p-1 text-gray-400 hover:text-sky-500 rounded" onClick={() => handleSwitch('ide')} disabled={switchingTarget !== null} title="切换 IDE">
              <Repeat2 className={`w-3.5 h-3.5 ${switchingTarget === 'ide' ? 'animate-spin text-sky-500' : ''}`} />
            </button>
          </>
        )}
        <button className="p-1 text-gray-400 hover:text-green-500 rounded" onClick={() => toggleAccount(account.id, account.disabled)} title={account.disabled ? '启用' : '禁用'}>
          {account.disabled ? <Zap className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
        </button>
        <button className="p-1 text-gray-400 hover:text-green-500 rounded" onClick={async () => { try { await fetchQuota(account.id); } catch (e) { showToast(String(e), 'error'); } }} title="刷新配额">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button className="p-1 text-gray-400 hover:text-orange-500 rounded" onClick={() => setIsEditingLabel(true)} title="编辑标签">
          <Tag className="w-3.5 h-3.5" />
        </button>
        <button className="p-1 text-gray-400 hover:text-sky-500 rounded" onClick={() => onViewDetails(account)} title="详情">
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button className={`p-1 rounded ${confirmDelete ? 'text-red-600' : 'text-gray-400 hover:text-red-500'}`} onClick={handleDelete} title={confirmDelete ? '确认删除' : '删除'}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function AntigravityPage() {
  const { t } = useTranslation();
  const { accounts, loadAccounts, refreshAllQuotas, loading, hasLoaded, importFromManager, batchDeleteAccounts, warmupAllAccounts } = useAntigravityStore();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const selectedAccount = selectedAccountId ? accounts.find(a => a.id === selectedAccountId) ?? null : null;
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [warmingUpAll, setWarmingUpAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!hasLoaded) {
      loadAccounts();
    }
  }, [hasLoaded, loadAccounts]);

  const filteredAccounts = useMemo(() => {
    let result = accounts;
    if (tierFilter !== 'all') {
      result = result.filter(a => {
        const tier = (a.subscriptionTier || 'FREE').toLowerCase();
        return tier.includes(tierFilter.toLowerCase());
      });
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(a =>
        a.email.toLowerCase().includes(query) ||
        (a.customLabel && a.customLabel.toLowerCase().includes(query)) ||
        (a.name && a.name.toLowerCase().includes(query))
      );
    }
    return result;
  }, [accounts, tierFilter, searchQuery]);

  // Compute aggregate stats from all accounts
  const stats = useMemo(() => {
    const total = accounts.length;
    const disabled = accounts.filter(a => a.disabled).length;
    const active = total - disabled;
    const paidCount = accounts.filter(a => {
      const tier = (a.subscriptionTier || 'FREE').toLowerCase();
      return tier.includes('pro') || tier.includes('ultra');
    }).length;

    // Average quota health: average percentage across all accounts that have quota data
    let avgQuota = 0;
    const accountsWithQuota = accounts.filter(a => a.quota && a.quota.models && a.quota.models.length > 0 && !a.quota.isForbidden);
    if (accountsWithQuota.length > 0) {
      const totalPct = accountsWithQuota.reduce((sum, a) => {
        const modelPctSum = a.quota!.models.reduce((s, m) => s + m.percentage, 0);
        return sum + modelPctSum / a.quota!.models.length;
      }, 0);
      avgQuota = Math.round(totalPct / accountsWithQuota.length);
    }

    return { total, active, disabled, avgQuota, paidCount };
  }, [accounts]);

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try {
      await refreshAllQuotas();
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await importFromManager();
      const parts: string[] = [];
      if (result.imported.length > 0) {
        parts.push(t('antigravity.import_success', { count: result.imported.length }));
      }
      if (result.skipped.length > 0) {
        parts.push(t('antigravity.import_skipped', { count: result.skipped.length }));
      }
      if (result.errors.length > 0) {
        parts.push(t('antigravity.import_errors', { count: result.errors.length }));
      }
      if (parts.length === 0) {
        showToast(t('antigravity.import_nothing'), 'info');
      } else {
        showToast(parts.join('\n'), result.imported.length > 0 ? 'success' : 'warning', 5000);
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleWarmupAll = async () => {
    setWarmingUpAll(true);
    try {
      const result = await warmupAllAccounts();
      showToast(result, 'success', 5000);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setWarmingUpAll(false);
    }
  };

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAccounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAccounts.map(a => a.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (!confirmBatchDelete) {
      setConfirmBatchDelete(true);
      setTimeout(() => setConfirmBatchDelete(false), 3000);
      return;
    }
    setDeletingBatch(true);
    try {
      const ids = Array.from(selectedIds);
      const deleted = await batchDeleteAccounts(ids);
      setSelectedIds(new Set());
      setSelectMode(false);
      setConfirmBatchDelete(false);
      showToast(t('antigravity.batch_delete_success', { count: deleted }), 'success');
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setDeletingBatch(false);
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setConfirmBatchDelete(false);
  };

  const tierOptions: { value: TierFilter; label: string }[] = [
    { value: 'all', label: t('antigravity.filter_all') },
    { value: 'FREE', label: 'FREE' },
    { value: 'PRO', label: 'PRO' },
    { value: 'ULTRA', label: 'ULTRA' },
  ];

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Fixed top section */}
      <div className="shrink-0">
        <div className="px-6 pt-6 pb-3 space-y-4 max-w-7xl mx-auto w-full">
          {/* Title bar */}
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-md">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-base-content">
                {t('antigravity.title')}
              </h1>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({filteredAccounts.length} / {accounts.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Select Mode Toggle */}
              {accounts.length > 0 && (
                <button
                  onClick={selectMode ? exitSelectMode : () => setSelectMode(true)}
                  className={`btn btn-sm gap-2 whitespace-nowrap ${selectMode ? 'btn-active' : 'btn-ghost'}`}
                >
                  <CheckSquare className="w-4 h-4" />
                  {selectMode ? t('antigravity.exit_select') : t('antigravity.select_mode')}
                </button>
              )}
              {/* Select All / Delete Selected in select mode */}
              {selectMode && (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="btn btn-ghost btn-sm gap-2 whitespace-nowrap"
                  >
                    <CheckSquare className="w-4 h-4" />
                    {selectedIds.size === filteredAccounts.length ? t('antigravity.deselect_all') : t('antigravity.select_all')}
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleBatchDelete}
                      disabled={deletingBatch}
                      className={`btn btn-sm gap-2 whitespace-nowrap ${confirmBatchDelete ? 'btn-error' : 'btn-ghost text-red-500 hover:text-red-600'}`}
                    >
                      {deletingBatch
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />
                      }
                      {t('antigravity.delete_selected', { count: selectedIds.size })}
                      {confirmBatchDelete && <span className="text-xs ml-1">({t('common.confirm')})</span>}
                    </button>
                  )}
                </>
              )}
              {!selectMode && (
                <>
                  <button
                    onClick={handleRefreshAll}
                    disabled={refreshingAll || loading}
                    className="btn btn-ghost btn-sm gap-2 whitespace-nowrap"
                  >
                    {refreshingAll
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    }
                    {t('antigravity.refresh_all')}
                  </button>
                  <button
                    onClick={handleWarmupAll}
                    disabled={warmingUpAll || loading}
                    className="btn btn-ghost btn-sm gap-2 whitespace-nowrap"
                  >
                    {warmingUpAll
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Zap className="w-4 h-4" />
                    }
                    {t('antigravity.warmup_all')}
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing || loading}
                    className="btn btn-ghost btn-sm gap-2 whitespace-nowrap"
                  >
                    {importing
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />
                    }
                    {t('antigravity.import_from_manager')}
                  </button>
                </>
              )}
              <button
                onClick={() => setShowAdd(true)}
                className="btn bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white border-none btn-sm gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {t('antigravity.add_account')}
              </button>
            </div>
          </div>

          {/* Selected count bar */}
          {selectMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              <CheckSquare className="w-4 h-4" />
              {t('antigravity.selected_count', { count: selectedIds.size })}
            </div>
          )}

          {/* Stats Bar */}
          {accounts.length > 0 && !selectMode && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard icon={Users} label={t('antigravity.stats_total')} value={stats.total} bgColor="bg-gray-500" />
              <StatCard icon={CheckCircle} label={t('antigravity.stats_active')} value={stats.active} bgColor="bg-green-500" />
              <StatCard icon={XCircle} label={t('antigravity.stats_disabled')} value={stats.disabled} bgColor="bg-red-500" />
              <StatCard icon={Activity} label={t('antigravity.stats_avg_quota')} value={`${stats.avgQuota}%`} bgColor="bg-blue-500" />
              <StatCard icon={Crown} label={t('antigravity.stats_paid_accounts')} value={stats.paidCount} bgColor="bg-purple-500" />
            </div>
          )}

          {/* Search + Filter + View Toggle */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
              <input
                type="text"
                placeholder={t('antigravity.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-bordered input-sm w-full pl-9"
              />
            </div>
            <select
              className="select select-bordered select-sm"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as TierFilter)}
            >
              {tierOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {accounts.length > 0 && (
              <div className="join">
                <button
                  className={`btn btn-sm join-item ${viewMode === 'grid' ? 'btn-active' : 'btn-ghost'}`}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  className={`btn btn-sm join-item ${viewMode === 'list' ? 'btn-active' : 'btn-ghost'}`}
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pb-6 space-y-4 max-w-7xl mx-auto">
          {/* Empty state - no accounts at all */}
          {accounts.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-pink-100 dark:from-orange-900/20 dark:to-pink-900/20 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('antigravity.empty_title')}</h3>
              <p className="text-base-content/60 mb-4 text-sm">
                {t('antigravity.empty_desc')}
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="btn bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white border-none gap-2 btn-sm"
              >
                <Plus className="w-4 h-4" />
                {t('antigravity.add_first_account')}
              </button>
            </div>
          )}

          {/* No match after filtering */}
          {filteredAccounts.length === 0 && accounts.length > 0 && (
            <div className="text-center py-16">
              <p className="text-base-content/60">{t('antigravity.no_match')}</p>
            </div>
          )}

          {/* Account Grid / List */}
          {filteredAccounts.length > 0 && (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {filteredAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onViewDetails={(a) => setSelectedAccountId(a.id)}
                    selectMode={selectMode}
                    selected={selectedIds.has(account.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAccounts.map((account) => (
                  <AccountListRow
                    key={account.id}
                    account={account}
                    onViewDetails={(a) => setSelectedAccountId(a.id)}
                    selectMode={selectMode}
                    selected={selectedIds.has(account.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <AddAccountDialog open={showAdd} onClose={() => setShowAdd(false)} />

      {selectedAccount && (
        <AccountDetailsDialog
          account={selectedAccount}
          open={!!selectedAccount}
          onClose={() => setSelectedAccountId(null)}
        />
      )}
    </div>
  );
}
