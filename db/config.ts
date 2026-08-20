import { getDb } from './schema';

export const CONFIG_KEYS = [
  'webdav_url',
  'webdav_user',
  'webdav_pass',
  'webdav_path',
  'bg_sync_interval',
  'backup_retention_days',
  'webdav_last_sync',
  'webdav_last_sync_ms',
  'webdav_backups',
  'gdrive_last_sync',
  'gdrive_last_sync_ms',
  'gdrive_email',
  'gdrive_folder_id',
  'gdrive_folder_name',
  'gdrive_file_id_db',
  'gdrive_file_id_enc',
  'gdrive_token_expiry',
  'gdrive_backups',
  'web_frontend_url',
  'enc_key',
  'enc_enabled',
] as const;

export type ConfigKey = typeof CONFIG_KEYS[number];

export async function getConfig(key: ConfigKey): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM config WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setConfig(key: ConfigKey, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
}

export async function deleteConfig(key: ConfigKey): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM config WHERE key = ?', [key]);
}

export async function getAllConfig(): Promise<Partial<Record<ConfigKey, string>>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM config');
  const result: Partial<Record<ConfigKey, string>> = {};
  for (const { key, value } of rows) {
    if ((CONFIG_KEYS as readonly string[]).includes(key)) {
      result[key as ConfigKey] = value;
    }
  }
  return result;
}
