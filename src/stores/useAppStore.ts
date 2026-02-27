import { create } from 'zustand';
import { AppType } from '../types/app';

interface AppState {
    currentApp: AppType;
    setCurrentApp: (app: AppType) => void;
}

export const useAppStore = create<AppState>((set) => ({
    currentApp: 'claude',
    setCurrentApp: (app) => set({ currentApp: app }),
}));
