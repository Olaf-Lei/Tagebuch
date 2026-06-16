import { getDb } from './schema';

export const CONFIG_KEYS = [
  'webdav_url',
  'webdav_user',
  'webdav_pass',
  'webdav_path',
  'bg_sync_interval',
  'backup_retention_days',
] as const;

export type ConfigKey = typeof CONFIG_KEYS[number];

export async function setConfig(key: ConfigKey, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
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
