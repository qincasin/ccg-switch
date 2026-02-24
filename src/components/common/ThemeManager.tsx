
import { useEffect } from 'react';
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

        // Sync to localStorage for early boot check
        localStorage.setItem('app-theme-preference', theme);
    }, [config?.theme]);

    return null;
}
