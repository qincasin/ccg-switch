import { create } from 'zustand';
import * as skillService from '../services/skillService';
import { Skill } from '../services/skillService';

interface SkillState {
    skills: Skill[];
    loading: boolean;
    error: string | null;
    loadSkills: (projectDir?: string) => Promise<void>;
    saveSkill: (name: string, content: string) => Promise<void>;
    deleteSkill: (name: string) => Promise<void>;
}

export const useSkillStore = create<SkillState>((set, get) => ({
    skills: [],
    loading: false,
    error: null,
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
}));
