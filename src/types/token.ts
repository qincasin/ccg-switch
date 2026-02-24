export interface ApiToken {
    id: string;
    name: string;
    apiKey: string;
    url?: string;
    defaultSonnetModel?: string;
    defaultOpusModel?: string;
    defaultHaikuModel?: string;
    customParams?: Record<string, any>;
    description?: string;
    isActive: boolean;
    createdAt: string;
    lastUsed?: string;
}
