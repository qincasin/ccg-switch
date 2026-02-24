import { invoke } from '@tauri-apps/api/core';

export interface Skill {
    name: string;
    content: string;
    file_path: string;
    source: 'user' | 'project';
}

export async function listSkills(projectDir?: string): Promise<Skill[]> {
    return await invoke<Skill[]>('list_skills', { projectDir });
}

export async function getSkill(name: string): Promise<Skill> {
    return await invoke<Skill>('get_skill', { name });
}

export async function saveSkill(name: string, content: string): Promise<void> {
    await invoke('save_skill', { name, content });
}

export async function deleteSkill(name: string): Promise<void> {
    await invoke('delete_skill', { name });
}
