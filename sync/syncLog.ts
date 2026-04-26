import * as SecureStore from 'expo-secure-store';

const STORE_KEY = 'sync_log';
const MAX_ENTRIES = 20;

export interface SyncLogEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

async function readEntries(): Promise<SyncLogEntry[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeEntries(entries: SyncLogEntry[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(entries));
  } catch {}
}

export async function appendLog(level: SyncLogEntry['level'], message: string): Promise<void> {
  const entries = await readEntries();
  entries.push({
    time: new Date().toISOString(),
    level,
    message,
  });
  await writeEntries(entries.slice(-MAX_ENTRIES));
}

export async function getSyncLog(): Promise<SyncLogEntry[]> {
  const entries = await readEntries();
  return entries.slice().reverse();
}

export async function clearSyncLog(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
}
