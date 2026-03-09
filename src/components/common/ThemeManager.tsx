
import { useEffect } from 'react';
import { setTheme as setAppTheme } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useConfigStore } from '../../stores/useConfigStore';

export default function ThemeManager() {
    const { config, loadConfig } = useConfigStore();

    // Load config on mount
    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    // Apply theme when config changes
    useEffect(() => {
        if (!config) return;

        const theme = config.theme || 'light';
        const isDark = theme === 'dark';
        const root = document.documentElement;

        // Set DaisyUI theme
        root.setAttribute('data-theme', theme);

        // Set inline style for immediate visual feedback
        root.style.backgroundColor = isDark ? '#1d232a' : '#FAFBFC';

        // Set Tailwind dark mode class
        if (isDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        // Sync native window title bar theme (app-level + window-level)
        const tauriTheme = isDark ? 'dark' as const : 'light' as const;
        setAppTheme(tauriTheme).catch(() => {});
        getCurrentWindow().setTheme(tauriTheme).catch(() => {});

        // Sync to localStorage for early boot check
        localStorage.setItem('app-theme-preference', theme);
    }, [config?.theme]);

    return null;
}
