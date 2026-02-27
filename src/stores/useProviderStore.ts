import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Provider } from '../types/provider';
import { AppType } from '../types/app';

interface ProviderState {
    providers: Provider[];
    hasLoaded: boolean;
    loading: boolean;
    error: string | null;

    loadProviders: (app: AppType, force?: boolean) => Promise<void>;
    loadAllProviders: (force?: boolean) => Promise<void>;
    addProvider: (data: Omit<Provider, 'id' | 'createdAt' | 'isActive' | 'lastUsed' | 'inFailoverQueue'>) => Promise<void>;
    updateProvider: (id: string, data: Partial<Provider>) => Promise<void>;
    switchProvider: (app: AppType, providerId: string) => Promise<void>;
    deleteProvider: (providerId: string) => Promise<void>;
    moveProvider: (providerId: string, targetIndex: number) => Promise<void>;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
    providers: [],
    hasLoaded: false,
    loading: false,
    error: null,

    loadProviders: async (app, force = false) => {
        if (!force && get().hasLoaded) return;
        set({ loading: true, error: null });
        try {
            const providers = await invoke<Provider[]>('get_providers', { app });
            set({ providers, loading: false, hasLoaded: true });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },

    loadAllProviders: async (force = false) => {
        if (!force && get().hasLoaded) return;
        set({ loading: true, error: null });
        try {
            const providers = await invoke<Provider[]>('get_all_providers');
            set({ providers, loading: false, hasLoaded: true });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },

    addProvider: async (data) => {
        set({ loading: true, error: null });
        try {
            const provider: Provider = {
                ...data,
                id: `provider-${Date.now()}`,
                isActive: false,
                inFailoverQueue: false,
                createdAt: new Date().toISOString(),
            };
            await invoke('add_provider', { provider });
            await get().loadAllProviders(true);
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    updateProvider: async (id, data) => {
        set({ loading: true, error: null });
        try {
            const existing = get().providers.find(p => p.id === id);
            if (!existing) {
                throw new Error('Provider not found');
            }
            const provider: Provider = {
                ...existing,
                ...data,
                id: existing.id,
                createdAt: existing.createdAt,
            };
            await invoke('update_provider', { providerId: id, provider });
            await get().loadAllProviders(true);
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    switchProvider: async (app, providerId) => {
        set({ loading: true, error: null });
        try {
            await invoke('switch_provider', { app, providerId });
            await get().loadAllProviders(true);
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    deleteProvider: async (providerId) => {
        set({ loading: true, error: null });
        try {
            await invoke('delete_provider', { providerId });
            await get().loadAllProviders(true);
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    moveProvider: async (providerId, targetIndex) => {
        set({ loading: true, error: null });
        try {
            await invoke('move_provider', { providerId, targetIndex });
            await get().loadAllProviders(true);
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
}));
