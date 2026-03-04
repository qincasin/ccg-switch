import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { InstalledSkillRow, SkillRepo, DiscoverableSkill } from '../types/skillV2';

interface SkillStoreV2State {
    installed: InstalledSkillRow[];
    repos: SkillRepo[];
    discoverable: DiscoverableSkill[];
    discovering: boolean;
    loading: boolean;
    error: string | null;

    loadInstalled: () => Promise<void>;
    loadRepos: () => Promise<void>;
    discoverSkills: () => Promise<void>;
    installSkill: (skill: DiscoverableSkill, currentApp?: string) => Promise<void>;
    uninstallSkill: (id: string) => Promise<void>;
    toggleApp: (id: string, app: string, enabled: boolean) => Promise<void>;
    saveRepo: (repo: SkillRepo) => Promise<void>;
    deleteRepo: (owner: string, name: string) => Promise<void>;
    scanAndImport: () => Promise<{ imported: number; skipped: number; names: string[] }>;
}

export const useSkillStoreV2 = create<SkillStoreV2State>((set, get) => ({
    installed: [],
    repos: [],
    discoverable: [],
    discovering: false,
    loading: false,
    error: null,

    loadInstalled: async () => {
        set({ loading: true, error: null });
        try {
            const installed = await invoke<InstalledSkillRow[]>('get_installed_skills');
            set({ installed, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },

    loadRepos: async () => {
        try {
            const repos = await invoke<SkillRepo[]>('get_skill_repos');
            set({ repos });
        } catch (error) {
            set({ error: String(error) });
        }
    },

    discoverSkills: async () => {
        set({ discovering: true, error: null });
        try {
            const discoverable = await invoke<DiscoverableSkill[]>('discover_skills');
            set({ discoverable, discovering: false });
        } catch (error) {
            set({ error: String(error), discovering: false });
        }
    },

    installSkill: async (skill: DiscoverableSkill, currentApp = 'claude') => {
        set({ loading: true, error: null });
        try {
            await invoke('install_skill', { skill, currentApp });
            await get().loadInstalled();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    uninstallSkill: async (id: string) => {
        set({ loading: true, error: null });
        try {
            await invoke('uninstall_skill', { id });
            await get().loadInstalled();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    toggleApp: async (id: string, app: string, enabled: boolean) => {
        set({ loading: true, error: null });
        try {
            await invoke('toggle_skill_app', { id, app, enabled });
            await get().loadInstalled();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    saveRepo: async (repo: SkillRepo) => {
        try {
            await invoke('save_skill_repo', { repo });
            await get().loadRepos();
        } catch (error) {
            set({ error: String(error) });
            throw error;
        }
    },

    deleteRepo: async (owner: string, name: string) => {
        try {
            await invoke('delete_skill_repo', { owner, name });
            await get().loadRepos();
        } catch (error) {
            set({ error: String(error) });
            throw error;
        }
    },

    scanAndImport: async () => {
        set({ loading: true, error: null });
        try {
            const [imported, skipped, names] = await invoke<[number, number, string[]]>('scan_and_import_skills');
            await get().loadInstalled();
            set({ loading: false });
            return { imported, skipped, names };
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
}));
