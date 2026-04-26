import {
  getInfoAsync,
  uploadAsync,
  downloadAsync,
  copyAsync,
  deleteAsync,
  cacheDirectory,
  FileSystemUploadType,
} from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { getDbPath, closeDb, initDb } from '../db/schema';
import { isEncryptionEnabled, encryptDbToTemp, decryptToPath } from '../utils/crypto';
import { appendLog } from './syncLog';

const STORE_URL = 'webdav_url';
const STORE_USER = 'webdav_user';
const STORE_PASS = 'webdav_pass';
const STORE_PATH = 'webdav_path';
const STORE_LAST_SYNC = 'webdav_last_sync';

export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
  path: string;
}

export async function loadConfig(): Promise<Partial<WebDavConfig>> {
  const [url, username, password, path] = await Promise.all([
    SecureStore.getItemAsync(STORE_URL),
    SecureStore.getItemAsync(STORE_USER),
    SecureStore.getItemAsync(STORE_PASS),
    SecureStore.getItemAsync(STORE_PATH),
  ]);
  return {
    url: url ?? '',
    username: username ?? '',
    password: password ?? '',
    path: path ?? '/Tagebuch/',
  };
}

export async function saveConfig(config: WebDavConfig): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(STORE_URL, config.url.trim()),
    SecureStore.setItemAsync(STORE_USER, config.username.trim()),
    SecureStore.setItemAsync(STORE_PASS, config.password),
    SecureStore.setItemAsync(STORE_PATH, config.path.trim()),
  ]);
}

export async function getLastSync(): Promise<string | null> {
  return SecureStore.getItemAsync(STORE_LAST_SYNC);
}

export async function syncNow(): Promise<void> {
  await appendLog('info', 'Sync gestartet');
  const config = await loadConfig();
  if (!config.url || !config.username || !config.password) {
    const msg = 'Nextcloud nicht konfiguriert.';
    await appendLog('error', msg);
    throw new Error(msg);
  }

  const rawPath = await getDbPath();
  const dbPath = rawPath.startsWith('file://') ? rawPath : `file://${rawPath}`;
  await appendLog('info', `DB-Pfad: ${dbPath}`);

  const info = await getInfoAsync(dbPath);
  if (!info.exists) {
    const msg = 'Datenbank nicht gefunden.';
    await appendLog('error', msg);
    throw new Error(msg);
  }

  const encrypted = await isEncryptionEnabled();
  const remoteFilename = encrypted ? 'tagebuch.db.enc' : 'tagebuch.db';
  const base = config.url.replace(/\/$/, '');
  const remotePath = (config.path ?? '/Tagebuch/').replace(/\/$/, '') + '/' + remoteFilename;
  const uploadUrl = base.includes('/remote.php/dav') || base.includes('/webdav')
    ? `${base}${remotePath}`
    : `${base}/remote.php/dav/files/${encodeURIComponent(config.username!.trim())}${remotePath}`;

  await appendLog('info', `Upload-URL: ${uploadUrl}`);
  await appendLog('info', `Verschlüsselung: ${encrypted ? 'ja' : 'nein'}`);

  let uploadPath = dbPath;
  let tempPath: string | null = null;
  if (encrypted) {
    try {
      tempPath = await encryptDbToTemp(rawPath);
      uploadPath = tempPath.startsWith('file://') ? tempPath : `file://${tempPath}`;
      await appendLog('info', `Verschlüsselt nach: ${uploadPath}`);
    } catch (e: any) {
      const msg = `Verschlüsselung fehlgeschlagen: ${e?.message ?? String(e)}`;
      await appendLog('error', msg);
      throw new Error(msg);
    }
  }

  const credentials = btoa(`${config.username}:${config.password}`);

  let result: { status: number };
  try {
    result = await uploadAsync(uploadUrl, uploadPath, {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/octet-stream',
      },
    });
    await appendLog('info', `HTTP-Status: ${result.status}`);
  } catch (e: any) {
    if (tempPath) await deleteAsync(`file://${tempPath}`, { idempotent: true }).catch(() => {});
    const msg = `Netzwerkfehler: ${e?.message ?? String(e)}`;
    await appendLog('error', msg);
    throw new Error(msg);
  }

  if (tempPath) await deleteAsync(`file://${tempPath}`, { idempotent: true }).catch(() => {});

  if (result.status >= 400) {
    const msg =
      result.status === 401
        ? 'Authentifizierung fehlgeschlagen. Benutzername oder Passwort falsch.'
        : result.status === 404
          ? 'Verzeichnis nicht gefunden. Bitte Pfad in den Einstellungen prüfen.'
          : `Fehler ${result.status}: Upload fehlgeschlagen.`;
    await appendLog('error', msg);
    throw new Error(msg);
  }

  const now = new Date().toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  await SecureStore.setItemAsync(STORE_LAST_SYNC, now);
  await appendLog('info', 'Sync erfolgreich');
}

export async function restoreNow(): Promise<void> {
  await appendLog('info', 'Restore gestartet');
  const config = await loadConfig();
  if (!config.url || !config.username || !config.password) {
    const msg = 'Nextcloud nicht konfiguriert.';
    await appendLog('error', msg);
    throw new Error(msg);
  }

  const encrypted = await isEncryptionEnabled();
  const remoteFilename = encrypted ? 'tagebuch.db.enc' : 'tagebuch.db';
  const base = config.url.replace(/\/$/, '');
  const remotePath = (config.path ?? '/Tagebuch/').replace(/\/$/, '') + '/' + remoteFilename;
  const downloadUrl = base.includes('/remote.php/dav') || base.includes('/webdav')
    ? `${base}${remotePath}`
    : `${base}/remote.php/dav/files/${encodeURIComponent(config.username!.trim())}${remotePath}`;

  await appendLog('info', `Download-URL: ${downloadUrl}`);

  const credentials = btoa(`${config.username}:${config.password}`);
  const tempPath = (cacheDirectory ?? '') + 'tagebuch_restore.tmp';

  let dlResult: { status: number };
  try {
    dlResult = await downloadAsync(downloadUrl, tempPath, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    await appendLog('info', `HTTP-Status: ${dlResult.status}`);
  } catch (e: any) {
    const msg = `Netzwerkfehler beim Download: ${e?.message ?? String(e)}`;
    await appendLog('error', msg);
    throw new Error(msg);
  }

  if (dlResult.status >= 400) {
    await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
    const msg =
      dlResult.status === 401
        ? 'Authentifizierung fehlgeschlagen.'
        : dlResult.status === 404
          ? 'Kein Backup gefunden. Zuerst synchronisieren.'
          : `Fehler ${dlResult.status}: Download fehlgeschlagen.`;
    await appendLog('error', msg);
    throw new Error(msg);
  }

  const rawDbPath = await getDbPath();
  await closeDb();
  await appendLog('info', 'DB geschlossen, ersetze Datei…');

  try {
    if (encrypted) {
      await decryptToPath(tempPath, rawDbPath);
    } else {
      await deleteAsync(`file://${rawDbPath}`, { idempotent: true });
      await copyAsync({ from: tempPath, to: `file://${rawDbPath}` });
    }
    await deleteAsync(`file://${rawDbPath}-wal`, { idempotent: true }).catch(() => {});
    await deleteAsync(`file://${rawDbPath}-shm`, { idempotent: true }).catch(() => {});
  } catch (e: any) {
    const msg = `Fehler beim Ersetzen der DB: ${e?.message ?? String(e)}`;
    await appendLog('error', msg);
    throw new Error(msg);
  } finally {
    await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
  }

  await initDb();
  await appendLog('info', 'Restore erfolgreich');
}
