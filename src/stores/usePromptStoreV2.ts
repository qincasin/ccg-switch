import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { PromptRow } from '../types/promptV2';

interface PromptStoreV2State {
    prompts: PromptRow[];
    loading: boolean;
    liveContent: string | null;
    error: string | null;

    loadPrompts: (appType: string) => Promise<void>;
    upsertPrompt: (prompt: PromptRow) => Promise<void>;
    deletePrompt: (id: string, appType: string) => Promise<void>;
    enablePrompt: (id: string, appType: string) => Promise<void>;
    disablePrompt: (id: string, appType: string) => Promise<void>;
    importFromFile: (appType: string) => Promise<string>;
    loadLiveContent: (appType: string) => Promise<void>;
}

export const usePromptStoreV2 = create<PromptStoreV2State>((set) => ({
    prompts: [],
    loading: false,
    liveContent: null,
    error: null,

    loadPrompts: async (appType: string) => {
        set({ loading: true, error: null });
        try {
            const prompts = await invoke<PromptRow[]>('get_prompts_v2', { appType });
            set({ prompts, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },

    upsertPrompt: async (prompt: PromptRow) => {
        set({ loading: true, error: null });
        try {
            await invoke('upsert_prompt_v2', { prompt });
            const prompts = await invoke<PromptRow[]>('get_prompts_v2', { appType: prompt.appType });
            set({ prompts, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    deletePrompt: async (id: string, appType: string) => {
        set({ loading: true, error: null });
        try {
            await invoke('delete_prompt_v2', { id, appType });
            const prompts = await invoke<PromptRow[]>('get_prompts_v2', { appType });
            set({ prompts, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    enablePrompt: async (id: string, appType: string) => {
        set({ loading: true, error: null });
        try {
            await invoke('enable_prompt_v2', { id, appType });
            const prompts = await invoke<PromptRow[]>('get_prompts_v2', { appType });
            set({ prompts, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    disablePrompt: async (id: string, appType: string) => {
        set({ loading: true, error: null });
        try {
            await invoke('disable_prompt_v2', { id, appType });
            const prompts = await invoke<PromptRow[]>('get_prompts_v2', { appType });
            set({ prompts, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    importFromFile: async (appType: string) => {
        set({ loading: true, error: null });
        try {
            const id = await invoke<string>('import_prompt_from_file', { appType });
            const prompts = await invoke<PromptRow[]>('get_prompts_v2', { appType });
            set({ prompts, loading: false });
            return id;
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    loadLiveContent: async (appType: string) => {
        try {
            const content = await invoke<string | null>('get_prompt_live_content', { appType });
            set({ liveContent: content });
        } catch (error) {
            set({ error: String(error) });
        }
    },
}));
