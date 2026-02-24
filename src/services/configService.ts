import { invoke } from '@tauri-apps/api/core';
import { Config } from '../types/config';

export async function loadConfig(): Promise<Config> {
    return await invoke<Config>('get_config');
}

export async function saveConfig(config: Config): Promise<void> {
    await invoke('save_config', { config });
}
