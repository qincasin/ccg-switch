export interface Config {
    theme: 'light' | 'dark';
    language: 'en' | 'zh';
}

export interface ApiConfig {
    name: string;
    token: string;
    url: string;
    model: string;
    customParams?: Record<string, any>;
}
