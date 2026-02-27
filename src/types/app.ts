export type AppType = 'claude' | 'codex' | 'gemini' | 'opencode' | 'openclaw';

export const APP_TYPES: AppType[] = ['claude', 'codex', 'gemini', 'opencode', 'openclaw'];

export const APP_LABELS: Record<AppType, string> = {
    claude: 'Claude',
    codex: 'Codex',
    gemini: 'Gemini',
    opencode: 'OpenCode',
    openclaw: 'OpenClaw',
};

export const APP_COLORS: Record<AppType, string> = {
    claude: '#D97706',
    codex: '#059669',
    gemini: '#2563EB',
    opencode: '#7C3AED',
    openclaw: '#DC2626',
};
