/// per-app 启用开关：key 为应用标识符，value 为是否启用
export type McpApps = Record<string, boolean>;

export interface McpServer {
    id: string;
    name: string;
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    enabled: boolean;
    transport: 'stdio' | 'http' | 'sse';
    source: 'global' | 'project';
    /// per-app 启用开关；undefined 或空对象表示旧数据，视为全部应用启用
    apps?: McpApps;
}

/// 应用标识符常量
export const APP_KEYS = ['claude_code', 'cursor', 'windsurf', 'vscode', 'other'] as const;
export type AppKey = (typeof APP_KEYS)[number];

/// 应用显示标签
export const APP_LABELS: Record<AppKey, string> = {
    claude_code: 'Claude Code',
    cursor: 'Cursor',
    windsurf: 'Windsurf',
    vscode: 'VS Code',
    other: '其他',
};
