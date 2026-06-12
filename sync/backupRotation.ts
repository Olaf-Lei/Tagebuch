import * as SecureStore from 'expo-secure-store';

const STORE_RETENTION = 'backup_retention_days';
const STORE_WD_BACKUPS = 'webdav_backups';
const STORE_GD_BACKUPS = 'gdrive_backups';

export const DEFAULT_RETENTION = 7;

export type BackupEntry = { date: string; enc: boolean };
export type DriveBackupEntry = { date: string; fileId: string; enc: boolean };

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function cutoffStr(retentionDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - retentionDays);
  return d.toISOString().slice(0, 10);
}

export async function getRetentionDays(): Promise<number> {
  const v = await SecureStore.getItemAsync(STORE_RETENTION);
  return v ? Number(v) : DEFAULT_RETENTION;
}

export async function setRetentionDays(days: number): Promise<void> {
  await SecureStore.setItemAsync(STORE_RETENTION, String(days));
}

export async function getWebdavBackups(): Promise<BackupEntry[]> {
  const v = await SecureStore.getItemAsync(STORE_WD_BACKUPS);
  if (!v) return [];
  try { return JSON.parse(v) as BackupEntry[]; } catch { return []; }
}

export async function saveWebdavBackups(backups: BackupEntry[]): Promise<void> {
  await SecureStore.setItemAsync(STORE_WD_BACKUPS, JSON.stringify(backups));
}

export async function getDriveBackups(): Promise<DriveBackupEntry[]> {
  const v = await SecureStore.getItemAsync(STORE_GD_BACKUPS);
  if (!v) return [];
  try { return JSON.parse(v) as DriveBackupEntry[]; } catch { return []; }
}

export async function saveDriveBackups(backups: DriveBackupEntry[]): Promise<void> {
  await SecureStore.setItemAsync(STORE_GD_BACKUPS, JSON.stringify(backups));
}
