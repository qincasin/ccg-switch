import { create } from 'zustand';
import * as subagentService from '../services/subagentService';
import { Subagent } from '../services/subagentService';

interface SubagentState {
    subagents: Subagent[];
    loading: boolean;
    error: string | null;
    loadSubagents: () => Promise<void>;
    saveSubagent: (name: string, content: string) => Promise<void>;
    deleteSubagent: (name: string) => Promise<void>;
}

export const useSubagentStore = create<SubagentState>((set, get) => ({
    subagents: [],
    loading: false,
    error: null,
    loadSubagents: async () => {
        set({ loading: true, error: null });
        try {
            const subagents = await subagentService.listSubagents();
            set({ subagents, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },
    saveSubagent: async (name: string, content: string) => {
        set({ loading: true, error: null });
        try {
            await subagentService.saveSubagent(name, content);
            await get().loadSubagents();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
    deleteSubagent: async (name: string) => {
        set({ loading: true, error: null });
        try {
            await subagentService.deleteSubagent(name);
            await get().loadSubagents();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
}));
