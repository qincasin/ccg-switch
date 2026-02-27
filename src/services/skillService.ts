import { invoke } from '@tauri-apps/api/core';
import { SkillApps } from '../types/skill';

export interface Skill {
    name: string;
    content: string;
    file_path: string;
    source: 'user' | 'project';
    apps: SkillApps;
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

export async function updateSkillApps(name: string, apps: SkillApps): Promise<void> {
    await invoke('update_skill_apps', { name, apps });
}
