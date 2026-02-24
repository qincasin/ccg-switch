import { create } from 'zustand';
import * as promptService from '../services/promptService';
import { PromptPreset } from '../services/promptService';

interface PromptState {
    prompts: PromptPreset[];
    loading: boolean;
    error: string | null;
    loadPrompts: () => Promise<void>;
    savePrompt: (name: string, content: string) => Promise<void>;
    deletePrompt: (name: string) => Promise<void>;
}

export const usePromptStore = create<PromptState>((set, get) => ({
    prompts: [],
    loading: false,
    error: null,
    loadPrompts: async () => {
        set({ loading: true, error: null });
        try {
            const prompts = await promptService.listPrompts();
            set({ prompts, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },
    savePrompt: async (name: string, content: string) => {
        set({ loading: true, error: null });
        try {
            await promptService.savePrompt(name, content);
            await get().loadPrompts();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
    deletePrompt: async (name: string) => {
        set({ loading: true, error: null });
        try {
            await promptService.deletePrompt(name);
            await get().loadPrompts();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
}));
