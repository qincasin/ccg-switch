import { create } from 'zustand';
import { McpServer } from '../types/mcp';
import * as mcpService from '../services/mcpService';

interface McpState {
    servers: McpServer[];
    loading: boolean;
    error: string | null;

    // Actions
    loadServers: (projectDir?: string) => Promise<void>;
    addServer: (server: McpServer, isGlobal: boolean) => Promise<void>;
    deleteServer: (serverName: string, isGlobal: boolean) => Promise<void>;
}

export const useMcpStore = create<McpState>((set, get) => ({
    servers: [],
    loading: false,
    error: null,

    loadServers: async (projectDir?: string) => {
        set({ loading: true, error: null });
        try {
            const servers = await mcpService.listMcpServers(projectDir);
            set({ servers, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },

    addServer: async (server: McpServer, isGlobal: boolean) => {
        set({ loading: true, error: null });
        try {
            await mcpService.addMcpServer(server, isGlobal);
            // 重新加载列表
            await get().loadServers();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    deleteServer: async (serverName: string, isGlobal: boolean) => {
        set({ loading: true, error: null });
        try {
            await mcpService.deleteMcpServer(serverName, isGlobal);
            // 重新加载列表
            await get().loadServers();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
}));
