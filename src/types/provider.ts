import { AppType } from './app';

export interface Provider {
    id: string;
    name: string;
    appType: AppType;
    apiKey: string;
    url?: string;
    defaultSonnetModel?: string;
    defaultOpusModel?: string;
    defaultHaikuModel?: string;
    customParams?: Record<string, any>;
    settingsConfig?: any;
    meta?: Record<string, string>;
    icon?: string;
    inFailoverQueue: boolean;
    description?: string;
    isActive: boolean;
    createdAt: string;
    lastUsed?: string;
}
