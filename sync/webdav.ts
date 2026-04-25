import {
  getInfoAsync,
  uploadAsync,
  deleteAsync,
  FileSystemUploadType,
} from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { getDbPath } from '../db/schema';
import { isEncryptionEnabled, encryptDbToTemp } from '../utils/crypto';

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
  const config = await loadConfig();
  if (!config.url || !config.username || !config.password) {
    throw new Error('Nextcloud nicht konfiguriert.');
  }

  const rawPath = await getDbPath();
  const dbPath = rawPath.startsWith('file://') ? rawPath : `file://${rawPath}`;
  const info = await getInfoAsync(dbPath);
  if (!info.exists) throw new Error('Datenbank nicht gefunden.');

  const encrypted = await isEncryptionEnabled();
  const remoteFilename = encrypted ? 'tagebuch.db.enc' : 'tagebuch.db';
  const base = config.url.replace(/\/$/, '');
  const remotePath = (config.path ?? '/Tagebuch/').replace(/\/$/, '') + '/' + remoteFilename;
  const uploadUrl = base.includes('/remote.php/dav') || base.includes('/webdav')
    ? `${base}${remotePath}`
    : `${base}/remote.php/dav/files/${encodeURIComponent(config.username!.trim())}${remotePath}`;

  let uploadPath = dbPath;
  let tempPath: string | null = null;
  if (encrypted) {
    tempPath = await encryptDbToTemp(rawPath);
    uploadPath = tempPath.startsWith('file://') ? tempPath : `file://${tempPath}`;
  }

  const credentials = btoa(`${config.username}:${config.password}`);

  const result = await uploadAsync(uploadUrl, uploadPath, {
    httpMethod: 'PUT',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/octet-stream',
    },
  });

  if (tempPath) await deleteAsync(`file://${tempPath}`, { idempotent: true }).catch(() => {});

  if (result.status >= 400) {
    const msg =
      result.status === 401
        ? 'Authentifizierung fehlgeschlagen. Benutzername oder Passwort falsch.'
        : result.status === 404
          ? 'Verzeichnis nicht gefunden. Bitte Pfad in den Einstellungen prüfen.'
          : `Fehler ${result.status}: Upload fehlgeschlagen.`;
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
}
