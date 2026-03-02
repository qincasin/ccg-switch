import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { McpServerRow } from '../types/mcpV2';

interface McpStoreV2State {
    servers: McpServerRow[];
    loading: boolean;
    error: string | null;

    loadServers: () => Promise<void>;
    upsertServer: (server: McpServerRow) => Promise<void>;
    deleteServer: (id: string) => Promise<void>;
    toggleApp: (serverId: string, app: string, enabled: boolean) => Promise<void>;
    importFromApps: () => Promise<number>;
}

export const useMcpStoreV2 = create<McpStoreV2State>((set, get) => ({
    servers: [],
    loading: false,
    error: null,

    loadServers: async () => {
        set({ loading: true, error: null });
        try {
            const map = await invoke<Record<string, McpServerRow>>('get_mcp_servers');
            set({ servers: Object.values(map), loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },

    upsertServer: async (server: McpServerRow) => {
        set({ loading: true, error: null });
        try {
            await invoke('upsert_mcp_server', { server });
            await get().loadServers();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    deleteServer: async (id: string) => {
        set({ loading: true, error: null });
        try {
            await invoke('delete_mcp_server_v2', { id });
            await get().loadServers();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    toggleApp: async (serverId: string, app: string, enabled: boolean) => {
        set({ loading: true, error: null });
        try {
            await invoke('toggle_mcp_app', { serverId, app, enabled });
            await get().loadServers();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    importFromApps: async () => {
        set({ loading: true, error: null });
        try {
            const count = await invoke<number>('import_mcp_from_apps');
            await get().loadServers();
            return count;
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
}));
