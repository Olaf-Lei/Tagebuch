import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  readDirectoryAsync,
} from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { getDb, getDbPath } from '../db/schema';
import { cutoffStr, todayStr } from './backupRotation';

const STORE_LAST_DATE = 'local_backup_last_date';
const BACKUP_DIR = (documentDirectory ?? '') + 'backups/';

async function ensureBackupDir(): Promise<void> {
  const info = await getInfoAsync(BACKUP_DIR);
  if (!info.exists) {
    await makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }
}

export async function listLocalBackups(): Promise<string[]> {
  try {
    await ensureBackupDir();
    const files = await readDirectoryAsync(BACKUP_DIR);
    return files
      .filter(f => f.startsWith('tagebuch_') && f.endsWith('.db'))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function localBackupPath(filename: string): string {
  return BACKUP_DIR + filename;
}

export async function runDailyLocalBackup(retentionDays: number): Promise<void> {
  const today = todayStr();
  const lastDate = await SecureStore.getItemAsync(STORE_LAST_DATE);
  if (lastDate === today) return;

  await ensureBackupDir();

  const db = await getDb();
  const rawDbPath = await getDbPath();
  const destPath = BACKUP_DIR + `tagebuch_${today}.db`;

  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');
  await copyAsync({ from: `file://${rawDbPath}`, to: destPath });
  await SecureStore.setItemAsync(STORE_LAST_DATE, today);

  const cutoff = cutoffStr(retentionDays);
  const files = await readDirectoryAsync(BACKUP_DIR);
  for (const f of files) {
    if (!f.startsWith('tagebuch_') || !f.endsWith('.db')) continue;
    const date = f.slice(9, 19); // YYYY-MM-DD aus "tagebuch_YYYY-MM-DD.db"
    if (date < cutoff) {
      await deleteAsync(BACKUP_DIR + f, { idempotent: true }).catch(() => {});
    }
  }
}
