import { invoke } from '@tauri-apps/api/core';
import { WebDavConfig, AutoLaunchStatus, BackupEntry, BackupSettings } from '../types/advanced';

export async function getWebDavConfig(): Promise<WebDavConfig> {
  return invoke<WebDavConfig>('get_webdav_config');
}

export async function saveWebDavConfig(config: WebDavConfig): Promise<void> {
  return invoke('save_webdav_config', { config });
}

export async function getAutoLaunchStatus(): Promise<AutoLaunchStatus> {
  return invoke<AutoLaunchStatus>('get_auto_launch_status');
}

export async function setAutoLaunch(enabled: boolean): Promise<void> {
  return invoke('set_auto_launch', { enabled });
}

// 备份管理
export async function createDbBackup(): Promise<BackupEntry> {
  return invoke<BackupEntry>('create_db_backup');
}

export async function listDbBackups(): Promise<BackupEntry[]> {
  return invoke<BackupEntry[]>('list_db_backups');
}

export async function restoreDbBackup(filename: string): Promise<string> {
  return invoke<string>('restore_db_backup', { filename });
}

export async function deleteDbBackup(filename: string): Promise<void> {
  return invoke('delete_db_backup', { filename });
}

export async function renameDbBackup(oldName: string, newName: string): Promise<void> {
  return invoke('rename_db_backup', { oldName, newName });
}

export async function getBackupSettings(): Promise<BackupSettings> {
  return invoke<BackupSettings>('get_backup_settings');
}

export async function saveBackupSettings(settings: BackupSettings): Promise<void> {
  return invoke('save_backup_settings', { settings });
}
