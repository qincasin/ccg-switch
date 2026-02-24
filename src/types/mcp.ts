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
}
