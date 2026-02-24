import { invoke } from '@tauri-apps/api/core';

export interface PromptPreset {
    name: string;
    content: string;
    file_path: string;
}

export async function listPrompts(): Promise<PromptPreset[]> {
    return await invoke<PromptPreset[]>('list_prompts');
}

export async function getPrompt(name: string): Promise<PromptPreset> {
    return await invoke<PromptPreset>('get_prompt', { name });
}

export async function savePrompt(name: string, content: string): Promise<void> {
    await invoke('save_prompt', { name, content });
}

export async function deletePrompt(name: string): Promise<void> {
    await invoke('delete_prompt', { name });
}
