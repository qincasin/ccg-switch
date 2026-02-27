import { invoke } from '@tauri-apps/api/core';
import { McpServer, McpApps } from '../types/mcp';

export async function listMcpServers(projectDir?: string): Promise<McpServer[]> {
    return await invoke<McpServer[]>('list_mcp_servers', { projectDir });
}

export async function addMcpServer(server: McpServer, isGlobal: boolean): Promise<void> {
    await invoke('add_mcp_server', { server, isGlobal });
}

export async function deleteMcpServer(serverName: string, isGlobal: boolean): Promise<void> {
    await invoke('delete_mcp_server', { serverName, isGlobal });
}

export async function updateMcpServerApps(serverName: string, isGlobal: boolean, apps: McpApps): Promise<void> {
    await invoke('update_mcp_server_apps', { serverName, isGlobal, apps });
}
