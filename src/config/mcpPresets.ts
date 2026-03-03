// MCP 预设配置
import { McpServerConfig } from '../types/mcpV2';

export interface McpPreset {
    id: string;
    name: string;
    tags: string[];
    server: McpServerConfig;
    homepage?: string;
    docs?: string;
}

// 检测是否为 Windows 平台
const isWindows = (): boolean => {
    if (typeof navigator !== 'undefined') {
        return navigator.platform?.toLowerCase().includes('win') ||
            navigator.userAgent?.toLowerCase().includes('windows');
    }
    return false;
};

// 创建跨平台 npx 命令配置
// Windows 需要使用 cmd /c wrapper 来执行 npx.cmd
// Mac/Linux 可以直接执行 npx
const createNpxCommand = (
    packageName: string,
    extraArgs: string[] = [],
): { command: string; args: string[] } => {
    if (isWindows()) {
        return {
            command: 'cmd',
            args: ['/c', 'npx', ...extraArgs, packageName],
        };
    } else {
        return {
            command: 'npx',
            args: [...extraArgs, packageName],
        };
    }
};

// 预设 MCP 服务器配置
// 包含最常用、可快速落地的 stdio 模式示例
export const mcpPresets: McpPreset[] = [
    {
        id: 'fetch',
        name: 'mcp-server-fetch',
        tags: ['stdio', 'http', 'web'],
        server: {
            type: 'stdio',
            command: 'uvx',
            args: ['mcp-server-fetch'],
        },
        homepage: 'https://github.com/modelcontextprotocol/servers',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    },
    {
        id: 'time',
        name: '@modelcontextprotocol/server-time',
        tags: ['stdio', 'time', 'utility'],
        server: {
            type: 'stdio',
            ...createNpxCommand('@modelcontextprotocol/server-time', ['-y']),
        },
        homepage: 'https://github.com/modelcontextprotocol/servers',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
    },
    {
        id: 'memory',
        name: '@modelcontextprotocol/server-memory',
        tags: ['stdio', 'memory', 'graph'],
        server: {
            type: 'stdio',
            ...createNpxCommand('@modelcontextprotocol/server-memory', ['-y']),
        },
        homepage: 'https://github.com/modelcontextprotocol/servers',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    },
    {
        id: 'sequential-thinking',
        name: '@modelcontextprotocol/server-sequential-thinking',
        tags: ['stdio', 'thinking', 'reasoning'],
        server: {
            type: 'stdio',
            ...createNpxCommand('@modelcontextprotocol/server-sequential-thinking', ['-y']),
        },
        homepage: 'https://github.com/modelcontextprotocol/servers',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    },
    {
        id: 'context7',
        name: '@upstash/context7-mcp',
        tags: ['stdio', 'docs', 'search'],
        server: {
            type: 'stdio',
            ...createNpxCommand('@upstash/context7-mcp', ['-y']),
        },
        homepage: 'https://context7.com',
        docs: 'https://github.com/upstash/context7/blob/master/README.md',
    },
];

// 获取带国际化描述的预设
export const getMcpPresetWithDescription = (
    preset: McpPreset,
    t: (key: string) => string,
): McpPreset & { description: string } => {
    const descriptionKey = `mcp.presets.${preset.id}.description`;
    return {
        ...preset,
        description: t(descriptionKey),
    };
};

export default mcpPresets;
