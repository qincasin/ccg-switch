/**
 * Antigravity 账号管理 Zustand Store。
 * 封装所有 ag_* Tauri 命令调用，提供响应式状态管理。
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { AntigravityAccount, AntigravityQuotaData, AgOperationLog, ImportResult, RefreshStats, TokenStatus } from '../types/antigravity';

interface AntigravityState {
  accounts: AntigravityAccount[];
  hasLoaded: boolean;
  loading: boolean;
  error: string | null;
  loadAccounts: (force?: boolean) => Promise<void>;
  addAccount: (email: string, refreshToken: string) => Promise<AntigravityAccount>;
  oauthLogin: () => Promise<AntigravityAccount>;
  deleteAccount: (id: string) => Promise<void>;
  refreshToken: (id: string) => Promise<void>;
  fetchQuota: (id: string) => Promise<AntigravityQuotaData>;
  refreshAllQuotas: () => Promise<RefreshStats>;
  switchAccount: (id: string, targetIde?: string) => Promise<void>;
  updateLabel: (id: string, label: string | null) => Promise<void>;
  reorderAccounts: (orderedIds: string[]) => Promise<void>;
  exportAccounts: (ids: string[]) => Promise<[string, string][]>;
  importFromManager: () => Promise<ImportResult>;
  toggleAccount: (id: string, enable: boolean) => Promise<void>;
  batchDeleteAccounts: (ids: string[]) => Promise<number>;
  getOperationLogs: (accountId: string, limit?: number) => Promise<AgOperationLog[]>;
  getTokenStatus: (accountId: string) => Promise<TokenStatus>;
  warmupAccount: (accountId: string) => Promise<string>;
  warmupAllAccounts: () => Promise<string>;
}

export const useAntigravityStore = create<AntigravityState>((set, get) => ({
  accounts: [],
  hasLoaded: false,
  loading: false,
  error: null,

  loadAccounts: async (force = false) => {
    if (!force && get().hasLoaded) return;
    set({ loading: true, error: null });
    try {
      const accounts = await invoke<AntigravityAccount[]>('ag_list_accounts');
      set({ accounts, loading: false, hasLoaded: true });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  addAccount: async (email, refreshToken) => {
    const account = await invoke<AntigravityAccount>('ag_add_account', { email, refreshToken });
    await get().loadAccounts(true);
    return account;
  },

  oauthLogin: async () => {
    const account = await invoke<AntigravityAccount>('ag_oauth_login');
    await get().loadAccounts(true);
    return account;
  },

  deleteAccount: async (id) => {
    await invoke('ag_delete_account', { id });
    await get().loadAccounts(true);
  },

  refreshToken: async (id) => {
    await invoke('ag_refresh_token', { id });
    await get().loadAccounts(true);
  },

  fetchQuota: async (id) => {
    const quota = await invoke<AntigravityQuotaData>('ag_fetch_quota', { id });
    await get().loadAccounts(true);
    return quota;
  },

  refreshAllQuotas: async () => {
    const stats = await invoke<RefreshStats>('ag_refresh_all_quotas');
    await get().loadAccounts(true);
    return stats;
  },

  switchAccount: async (id, targetIde) => {
    await invoke('ag_switch_account', { id, targetIde: targetIde || null });
    await get().loadAccounts(true);
  },

  updateLabel: async (id, label) => {
    await invoke('ag_update_label', { id, label: label || null });
    await get().loadAccounts(true);
  },

  reorderAccounts: async (orderedIds) => {
    await invoke('ag_reorder_accounts', { orderedIds });
    await get().loadAccounts(true);
  },

  exportAccounts: async (ids) => {
    return await invoke<[string, string][]>('ag_export_accounts', { ids });
  },

  importFromManager: async () => {
    const result = await invoke<ImportResult>('ag_import_from_manager');
    await get().loadAccounts(true);
    return result;
  },

  toggleAccount: async (id, enable) => {
    await invoke('ag_toggle_account', { id, enable });
    await get().loadAccounts(true);
  },

  batchDeleteAccounts: async (ids) => {
    const deleted = await invoke<number>('ag_batch_delete_accounts', { ids });
    await get().loadAccounts(true);
    return deleted;
  },

  getOperationLogs: async (accountId, limit = 20) => {
    return await invoke<AgOperationLog[]>('ag_get_operation_logs', { accountId, limit });
  },

  getTokenStatus: async (accountId) => {
    return await invoke<TokenStatus>('ag_get_token_status', { accountId });
  },

  warmupAccount: async (accountId) => {
    return await invoke<string>('ag_warmup_account', { accountId });
  },

  warmupAllAccounts: async () => {
    return await invoke<string>('ag_warmup_all_accounts');
  },
}));
