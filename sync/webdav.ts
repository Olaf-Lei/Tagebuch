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
import { getDbPath, closeDb, initDb, getDb } from '../db/schema';
import { isEncryptionEnabled, encryptDbToTemp, decryptToPath, exportEncKey } from '../utils/crypto';
import { appendLog } from './syncLog';
import { mergeRemoteDb } from './mergeDb';

function buildWebDavUrl(base: string, dir: string, username: string, filename: string): string {
  const p = `${dir}/${filename}`;
  return base.includes('/remote.php/dav') || base.includes('/webdav')
    ? `${base}${p}`
    : `${base}/remote.php/dav/files/${encodeURIComponent(username.trim())}${p}`;
}

function downloadErrMsg(status: number): string {
  return status === 401 ? 'Authentifizierung fehlgeschlagen.' : `Fehler ${status}: Download fehlgeschlagen.`;
}

const STORE_URL = 'webdav_url';
const STORE_USER = 'webdav_user';
const STORE_PASS = 'webdav_pass';
const STORE_PATH = 'webdav_path';
const STORE_LAST_SYNC = 'webdav_last_sync';
const STORE_LAST_SYNC_MS = 'webdav_last_sync_ms';

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

export async function getLastSyncMs(): Promise<number | null> {
  const v = await SecureStore.getItemAsync(STORE_LAST_SYNC_MS);
  return v ? Number(v) : null;
}

let _syncInProgress = false;
const _syncListeners: Set<() => void> = new Set();

export function addSyncListener(cb: () => void): () => void {
  _syncListeners.add(cb);
  return () => _syncListeners.delete(cb);
}

function _notifySyncListeners() {
  _syncListeners.forEach((cb) => cb());
}

export async function syncIfConfigured(): Promise<void> {
  const config = await loadConfig();
  if (!config.url || !config.username || !config.password) return;
  syncNow().catch(() => {});
}

export async function syncNow(): Promise<void> {
  if (_syncInProgress) return;
  _syncInProgress = true;
  try {
    await _doSync();
    _notifySyncListeners();
  } finally {
    _syncInProgress = false;
  }
}

async function _doSync(): Promise<void> {
  await appendLog('info', 'Sync gestartet');
  const config = await loadConfig();
  if (!config.url || !config.username || !config.password) {
    const msg = 'Nextcloud nicht konfiguriert.';
    await appendLog('error', msg);
    throw new Error(msg);
  }

  const rawDbPath = await getDbPath();
  const dbPath = rawDbPath.startsWith('file://') ? rawDbPath : `file://${rawDbPath}`;
  const info = await getInfoAsync(dbPath);
  if (!info.exists) {
    const msg = 'Datenbank nicht gefunden.';
    await appendLog('error', msg);
    throw new Error(msg);
  }

  const credentials = btoa(`${config.username}:${config.password}`);
  const base = config.url.replace(/\/$/, '');
  const dir = (config.path ?? '/Tagebuch/').replace(/\/$/, '');
  const buildUrl = (filename: string) => buildWebDavUrl(base, dir, config.username!, filename);

  // Temp-Dateien im DB-Verzeichnis ablegen — sqlite ATTACH braucht einen Pfad
  // den die native SQLite-Schicht kennt (cacheDirectory ist nur im JS-Layer sichtbar)
  const dbDir = rawDbPath.substring(0, rawDbPath.lastIndexOf('/') + 1);
  const tempDownRaw = `${dbDir}tagebuch_merge.tmp`;
  const tempDownPath = `file://${tempDownRaw}`;
  let remoteExists = false;
  let remoteIsEnc = false;

  const encUrl = buildUrl('tagebuch.db.enc');
  await appendLog('info', `Suche Remote-DB: ${encUrl}`);

  let dl: { status: number };
  try {
    dl = await downloadAsync(encUrl, tempDownPath, { headers: { Authorization: `Basic ${credentials}` } });
  } catch (e: any) {
    const msg = `Netzwerkfehler beim Download: ${e?.message ?? String(e)}`;
    await appendLog('error', msg);
    throw new Error(msg);
  }

  if (dl.status === 200) {
    remoteExists = true;
    remoteIsEnc = true;
    await appendLog('info', 'Verschlüsselte Remote-DB gefunden.');
  } else if (dl.status === 404) {
    await deleteAsync(tempDownPath, { idempotent: true }).catch(() => {});
    const plainUrl = buildUrl('tagebuch.db');
    await appendLog('info', `Suche Remote-DB: ${plainUrl}`);
    try {
      dl = await downloadAsync(plainUrl, tempDownPath, { headers: { Authorization: `Basic ${credentials}` } });
    } catch (e: any) {
      const msg = `Netzwerkfehler beim Download: ${e?.message ?? String(e)}`;
      await appendLog('error', msg);
      throw new Error(msg);
    }
    if (dl.status === 200) {
      remoteExists = true;
      remoteIsEnc = false;
      await appendLog('info', 'Unverschlüsselte Remote-DB gefunden.');
    } else if (dl.status === 404) {
      await deleteAsync(tempDownPath, { idempotent: true }).catch(() => {});
      await appendLog('info', 'Kein Remote-Backup vorhanden — Erstsync.');
    } else {
      await deleteAsync(tempDownPath, { idempotent: true }).catch(() => {});
      const msg = downloadErrMsg(dl.status);
      await appendLog('error', msg);
      throw new Error(msg);
    }
  } else {
    await deleteAsync(tempDownPath, { idempotent: true }).catch(() => {});
    const msg = downloadErrMsg(dl.status);
    await appendLog('error', msg);
    throw new Error(msg);
  }

  if (remoteExists) {
    try {
      await mergeRemoteDb(tempDownRaw, remoteIsEnc, dbDir);
    } finally {
      await deleteAsync(tempDownPath, { idempotent: true }).catch(() => {});
    }
  }

  // WAL in Hauptdatei flushen — sonst enthält die .db beim Upload nur 1 leere Page
  const db = await getDb();
  await db.execAsync(`PRAGMA wal_checkpoint(TRUNCATE)`);

  const encrypted = await isEncryptionEnabled();
  const remoteFilename = encrypted ? 'tagebuch.db.enc' : 'tagebuch.db';
  const uploadUrl = buildUrl(remoteFilename);
  await appendLog('info', `Upload: ${uploadUrl}, Verschlüsselung: ${encrypted ? 'ja' : 'nein'}`);

  let uploadPath = dbPath;
  let tempUpPath: string | null = null;
  if (encrypted) {
    try {
      tempUpPath = await encryptDbToTemp(rawDbPath);
      uploadPath = tempUpPath.startsWith('file://') ? tempUpPath : `file://${tempUpPath}`;
    } catch (e: any) {
      const msg = `Verschlüsselung fehlgeschlagen: ${e?.message ?? String(e)}`;
      await appendLog('error', msg);
      throw new Error(msg);
    }
  }

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
    if (tempUpPath) await deleteAsync(`file://${tempUpPath}`, { idempotent: true }).catch(() => {});
    const msg = `Netzwerkfehler: ${e?.message ?? String(e)}`;
    await appendLog('error', msg);
    throw new Error(msg);
  }

  if (tempUpPath) await deleteAsync(`file://${tempUpPath}`, { idempotent: true }).catch(() => {});

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
  await SecureStore.setItemAsync(STORE_LAST_SYNC_MS, String(Date.now()));
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

  const credentials = btoa(`${config.username}:${config.password}`);
  const base = config.url.replace(/\/$/, '');
  const dir = (config.path ?? '/Tagebuch/').replace(/\/$/, '');
  const buildUrl = (filename: string) => buildWebDavUrl(base, dir, config.username!, filename);

  const tempPath = (cacheDirectory ?? '') + 'tagebuch_restore.tmp';
  const encUrl = buildUrl('tagebuch.db.enc');
  const plainUrl = buildUrl('tagebuch.db');

  await appendLog('info', `Suche Backup: ${encUrl}`);
  let dlResult: { status: number };
  try {
    dlResult = await downloadAsync(encUrl, tempPath, {
      headers: { Authorization: `Basic ${credentials}` },
    });
  } catch (e: any) {
    const msg = `Netzwerkfehler beim Download: ${e?.message ?? String(e)}`;
    await appendLog('error', msg);
    throw new Error(msg);
  }

  let isEncFile: boolean;

  if (dlResult.status === 200) {
    isEncFile = true;
    await appendLog('info', 'Verschlüsseltes Backup gefunden.');
  } else if (dlResult.status === 404) {
    await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
    await appendLog('info', `Suche Backup: ${plainUrl}`);
    try {
      dlResult = await downloadAsync(plainUrl, tempPath, {
        headers: { Authorization: `Basic ${credentials}` },
      });
    } catch (e: any) {
      const msg = `Netzwerkfehler beim Download: ${e?.message ?? String(e)}`;
      await appendLog('error', msg);
      throw new Error(msg);
    }
    if (dlResult.status === 200) {
      isEncFile = false;
      await appendLog('info', 'Unverschlüsseltes Backup gefunden.');
    } else {
      await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
      const msg = dlResult.status === 404
        ? 'Kein Backup gefunden. Zuerst synchronisieren.'
        : dlResult.status === 401
          ? 'Authentifizierung fehlgeschlagen.'
          : `Fehler ${dlResult.status}: Download fehlgeschlagen.`;
      await appendLog('error', msg);
      throw new Error(msg);
    }
  } else {
    await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
    const msg = downloadErrMsg(dlResult.status);
    await appendLog('error', msg);
    throw new Error(msg);
  }

  if (isEncFile) {
    const key = await exportEncKey();
    if (!key) {
      await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
      const msg =
        'Backup ist verschlüsselt, aber kein Schlüssel vorhanden.\n\n' +
        'Einstellungen → Sicherheit → Schlüssel exportieren (Gerät 1) → Schlüssel importieren (dieses Gerät).';
      await appendLog('error', msg);
      throw new Error(msg);
    }
  }

  const rawDbPath = await getDbPath();
  await closeDb();
  await appendLog('info', 'DB geschlossen, ersetze Datei…');

  try {
    if (isEncFile) {
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
