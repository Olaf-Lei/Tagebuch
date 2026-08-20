import { getConfig, setConfig } from '../db/config';

export const DEFAULT_RETENTION = 7;

export type BackupEntry = { date: string; enc: boolean };
export type DriveBackupEntry = { date: string; fileId: string; enc: boolean };

function _localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayStr(): string {
  return _localDateStr(new Date());
}

export function cutoffStr(retentionDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - retentionDays);
  return _localDateStr(d);
}

export async function getRetentionDays(): Promise<number> {
  const v = await getConfig('backup_retention_days');
  return v ? Number(v) : DEFAULT_RETENTION;
}

export async function setRetentionDays(days: number): Promise<void> {
  await setConfig('backup_retention_days', String(days));
}

export async function getWebdavBackups(): Promise<BackupEntry[]> {
  const v = await getConfig('webdav_backups');
  if (!v) return [];
  try { return JSON.parse(v) as BackupEntry[]; } catch { return []; }
}

export async function saveWebdavBackups(backups: BackupEntry[]): Promise<void> {
  await setConfig('webdav_backups', JSON.stringify(backups));
}

export async function getDriveBackups(): Promise<DriveBackupEntry[]> {
  const v = await getConfig('gdrive_backups');
  if (!v) return [];
  try { return JSON.parse(v) as DriveBackupEntry[]; } catch { return []; }
}

export async function saveDriveBackups(backups: DriveBackupEntry[]): Promise<void> {
  await setConfig('gdrive_backups', JSON.stringify(backups));
}
