export interface SessionMeta {
    providerId: 'claude' | 'codex' | 'gemini';
    sessionId: string;
    title: string | null;
    summary: string | null;
    projectDir: string | null;
    createdAt: number;
    lastActiveAt: number;
    sourcePath: string;
    resumeCommand: string | null;
}

export interface UnifiedSessionMessage {
    role: string;
    content: string;
    ts?: string;
}

export type ProviderFilter = 'all' | 'claude' | 'codex' | 'gemini';
export type ViewMode = 'project' | 'all';
