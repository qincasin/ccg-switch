import { create } from 'zustand';
import { McpServer, McpApps } from '../types/mcp';
import * as mcpService from '../services/mcpService';

interface McpState {
    servers: McpServer[];
    loading: boolean;
    error: string | null;
    /// 当前过滤应用；null 表示"全部"
    currentApp: string | null;

    // Actions
    loadServers: (projectDir?: string) => Promise<void>;
    addServer: (server: McpServer, isGlobal: boolean) => Promise<void>;
    deleteServer: (serverName: string, isGlobal: boolean) => Promise<void>;
    setCurrentApp: (app: string | null) => void;
    toggleServerForApp: (serverName: string, isGlobal: boolean, app: string, enabled: boolean) => Promise<void>;
}

export const useMcpStore = create<McpState>((set, get) => ({
    servers: [],
    loading: false,
    error: null,
    currentApp: null,

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

    setCurrentApp: (app: string | null) => {
        set({ currentApp: app });
    },

    toggleServerForApp: async (serverName: string, isGlobal: boolean, app: string, enabled: boolean) => {
        set({ loading: true, error: null });
        try {
            // 获取当前服务器的 apps 配置
            const server = get().servers.find((s) => s.name === serverName);
            const currentApps: McpApps = server?.apps ?? {};
            const newApps: McpApps = { ...currentApps, [app]: enabled };
            await mcpService.updateMcpServerApps(serverName, isGlobal, newApps);
            // 重新加载列表
            await get().loadServers();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
}));
