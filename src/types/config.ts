export type SidebarPosition = 'left' | 'right' | 'top';
export type TerminalType = 'cmd' | 'powershell' | 'wt' | 'terminal' | 'iterm' | 'warp' | 'xterm' | 'gnome-terminal' | 'konsole';

export interface Config {
    theme: 'light' | 'dark';
    language: 'en' | 'zh';
    sidebarPosition: SidebarPosition;
    preferredTerminal: TerminalType;
    autoCheckUpdate?: boolean;
    checkUpdateIntervalHours?: number;
}

export interface ApiConfig {
    name: string;
    token: string;
    url: string;
    model: string;
    customParams?: Record<string, any>;
}
