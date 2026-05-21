import * as SecureStore from 'expo-secure-store';

const STORE_NC_ERROR = 'sync_nc_last_error';
const STORE_GDRIVE_ERROR = 'sync_gdrive_last_error';

let _anySyncInProgress = false;
const _listeners = new Set<() => void>();

export function acquireSyncLock(): boolean {
  if (_anySyncInProgress) return false;
  _anySyncInProgress = true;
  return true;
}

export function releaseSyncLock(): void {
  _anySyncInProgress = false;
  _listeners.forEach(cb => cb());
}

export async function setSyncError(source: 'nc' | 'gdrive', err: string | null): Promise<void> {
  const key = source === 'nc' ? STORE_NC_ERROR : STORE_GDRIVE_ERROR;
  if (err) {
    await SecureStore.setItemAsync(key, err);
  } else {
    await SecureStore.deleteItemAsync(key).catch(() => {});
  }
  _listeners.forEach(cb => cb());
}

export async function getSyncErrors(): Promise<{ nc: string | null; gdrive: string | null }> {
  const [nc, gdrive] = await Promise.all([
    SecureStore.getItemAsync(STORE_NC_ERROR),
    SecureStore.getItemAsync(STORE_GDRIVE_ERROR),
  ]);
  return { nc, gdrive };
}

export function addSyncStateListener(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}
