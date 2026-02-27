import { create } from 'zustand';
import * as skillService from '../services/skillService';
import { Skill } from '../services/skillService';
import { SkillApps } from '../types/skill';

interface SkillState {
    skills: Skill[];
    loading: boolean;
    error: string | null;
    currentApp: string | null;
    loadSkills: (projectDir?: string) => Promise<void>;
    saveSkill: (name: string, content: string) => Promise<void>;
    deleteSkill: (name: string) => Promise<void>;
    setCurrentApp: (app: string | null) => void;
    toggleSkillForApp: (name: string, app: string, enabled: boolean) => Promise<void>;
}

export const useSkillStore = create<SkillState>((set, get) => ({
    skills: [],
    loading: false,
    error: null,
    currentApp: null,
    loadSkills: async (projectDir?: string) => {
        set({ loading: true, error: null });
        try {
            const skills = await skillService.listSkills(projectDir);
            set({ skills, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },
    saveSkill: async (name: string, content: string) => {
        set({ loading: true, error: null });
        try {
            await skillService.saveSkill(name, content);
            await get().loadSkills();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
    deleteSkill: async (name: string) => {
        set({ loading: true, error: null });
        try {
            await skillService.deleteSkill(name);
            await get().loadSkills();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
    setCurrentApp: (app: string | null) => {
        set({ currentApp: app });
    },
    toggleSkillForApp: async (name: string, app: string, enabled: boolean) => {
        set({ loading: true, error: null });
        try {
            const skill = get().skills.find((s) => s.name === name);
            const currentApps: SkillApps = skill?.apps ?? {};
            const newApps: SkillApps = { ...currentApps, [app]: enabled };
            await skillService.updateSkillApps(name, newApps);
            await get().loadSkills();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
}));
