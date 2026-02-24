import { invoke } from '@tauri-apps/api/core';

export interface Subagent {
    name: string;
    content: string;
    file_path: string;
}

export async function listSubagents(): Promise<Subagent[]> {
    return await invoke<Subagent[]>('list_subagents');
}

export async function getSubagent(name: string): Promise<Subagent> {
    return await invoke<Subagent>('get_subagent', { name });
}

export async function saveSubagent(name: string, content: string): Promise<void> {
    await invoke('save_subagent', { name, content });
}

export async function deleteSubagent(name: string): Promise<void> {
    await invoke('delete_subagent', { name });
}
