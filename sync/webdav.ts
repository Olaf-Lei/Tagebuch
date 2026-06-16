import {
  getInfoAsync,
  uploadAsync,
  downloadAsync,
  deleteAsync,
  cacheDirectory,
  FileSystemUploadType,
} from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { getDbPath, getDb } from '../db/schema';
import { setConfig } from '../db/config';
import { isEncryptionEnabled, encryptDbToTemp, exportEncKey } from '../utils/crypto';
import { appendLog } from './syncLog';
import { mergeRemoteDb } from './mergeDb';
import { acquireSyncLock, releaseSyncLock, setSyncError } from './syncState';
import { applyRestore } from './restoreHelper';
import {
  todayStr,
  cutoffStr,
  getRetentionDays,
  getWebdavBackups,
  saveWebdavBackups,
  type BackupEntry,
} from './backupRotation';

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
  if (!config.url.trim().startsWith('https://')) throw new Error('Nextcloud-URL muss mit https:// beginnen');
  await Promise.all([
    SecureStore.setItemAsync(STORE_URL, config.url.trim()),
    SecureStore.setItemAsync(STORE_USER, config.username.trim()),
    SecureStore.setItemAsync(STORE_PASS, config.password),
    SecureStore.setItemAsync(STORE_PATH, config.path.trim()),
  ]);
  await Promise.all([
    setConfig('webdav_url', config.url.trim()),
    setConfig('webdav_user', config.username.trim()),
    setConfig('webdav_pass', config.password),
    setConfig('webdav_path', config.path.trim()),
  ]).catch(() => {});
}

export async function getLastSync(): Promise<string | null> {
  return SecureStore.getItemAsync(STORE_LAST_SYNC);
}

export async function getLastSyncMs(): Promise<number | null> {
  const v = await SecureStore.getItemAsync(STORE_LAST_SYNC_MS);
  return v ? Number(v) : null;
}

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
  if (!acquireSyncLock()) return;
  try {
    await setSyncError('nc', null);
    await _doSync();
    _notifySyncListeners();
  } catch (e: any) {
    await setSyncError('nc', e.message ?? String(e));
    throw e;
  } finally {
    releaseSyncLock();
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

  await _uploadWebdav(rawDbPath, dbPath, credentials, buildUrl);
  await appendLog('info', 'Sync erfolgreich');
}

async function _uploadWebdav(
  rawDbPath: string,
  dbPath: string,
  credentials: string,
  buildUrl: (filename: string) => string,
): Promise<void> {
  const db = await getDb();
  const localCheck = await db.getFirstAsync<{ integrity_check: string }>(`PRAGMA integrity_check`);
  if (localCheck?.integrity_check !== 'ok') {
    const details = localCheck?.integrity_check ?? 'unbekannt';
    await appendLog('error', `Lokale DB beschädigt, Upload abgebrochen: ${details}`);
    throw new Error(`local_corrupt: ${details}`);
  }

  // WAL vollständig in Hauptdatei schreiben; Ergebnis prüfen
  const cp = await db.getFirstAsync<{ busy: number; log: number; checkpointed: number }>(
    `PRAGMA wal_checkpoint(FULL)`,
  );
  if (cp && cp.log !== cp.checkpointed) {
    await appendLog('warn', `WAL-Checkpoint unvollständig (${cp.checkpointed}/${cp.log}), retry…`);
    const cp2 = await db.getFirstAsync<{ busy: number; log: number; checkpointed: number }>(
      `PRAGMA wal_checkpoint(FULL)`,
    );
    if (cp2 && cp2.log !== cp2.checkpointed) {
      const msg = `WAL-Checkpoint fehlgeschlagen (${cp2.checkpointed}/${cp2.log}) — Upload abgebrochen`;
      await appendLog('error', msg);
      throw new Error(msg);
    }
  }

  const encrypted = await isEncryptionEnabled();
  const remoteFilename = encrypted ? 'tagebuch.db.enc' : 'tagebuch.db';
  const remoteTmpFilename = encrypted ? 'tagebuch.db.enc.tmp' : 'tagebuch.db.tmp';
  const tmpUrl = buildUrl(remoteTmpFilename);
  const finalUrl = buildUrl(remoteFilename);

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

  const localInfo = await getInfoAsync(uploadPath);
  const localSize = localInfo.exists ? localInfo.size : 0;
  await appendLog('info', `Upload → ${remoteTmpFilename}, ${localSize} bytes, enc: ${encrypted ? 'ja' : 'nein'}`);

  let result: { status: number };
  try {
    result = await uploadAsync(tmpUrl, uploadPath, {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/octet-stream',
      },
    });
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

  // Atomares Umbenennen: .tmp → finale Datei; unterbricht ein Absturz den Upload,
  // bleibt nur die wertlose .tmp — die produktive Datei bleibt unberührt
  const moveResp = await fetch(tmpUrl, {
    method: 'MOVE',
    headers: {
      Authorization: `Basic ${credentials}`,
      Destination: finalUrl,
      Overwrite: 'T',
    },
  });
  if (!moveResp.ok) {
    await fetch(tmpUrl, { method: 'DELETE', headers: { Authorization: `Basic ${credentials}` } }).catch(() => {});
    const msg = `WebDAV MOVE fehlgeschlagen: HTTP ${moveResp.status}`;
    await appendLog('error', msg);
    throw new Error(msg);
  }

  await appendLog('info', `Upload OK (${result.status}), MOVE OK (${moveResp.status})`);

  await _rotateWebdavBackups(buildUrl, credentials, encrypted).catch(async (e) => {
    await appendLog('warn', `Backup-Rotation fehlgeschlagen: ${e?.message ?? String(e)}`);
  });

  const now = new Date().toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  await SecureStore.setItemAsync(STORE_LAST_SYNC, now);
  await SecureStore.setItemAsync(STORE_LAST_SYNC_MS, String(Date.now()));
}

async function _rotateWebdavBackups(
  buildUrl: (f: string) => string,
  credentials: string,
  encrypted: boolean,
): Promise<void> {
  const today = todayStr();
  const retention = await getRetentionDays();
  const backups = await getWebdavBackups();

  if (!backups.find((b) => b.date === today)) {
    const mainFile = encrypted ? 'tagebuch.db.enc' : 'tagebuch.db';
    const backupFile = encrypted ? `tagebuch_${today}.db.enc` : `tagebuch_${today}.db`;
    const copyResp = await fetch(buildUrl(mainFile), {
      method: 'COPY',
      headers: {
        Authorization: `Basic ${credentials}`,
        Destination: buildUrl(backupFile),
        Overwrite: 'T',
      },
    });
    if (copyResp.ok) {
      backups.unshift({ date: today, enc: encrypted });
      await appendLog('info', `Backup angelegt: ${backupFile}`);
    }
  }

  const cutoff = cutoffStr(retention);
  const toDelete = backups.filter((b) => b.date < cutoff);
  const toKeep = backups.filter((b) => b.date >= cutoff);

  for (const b of toDelete) {
    const filename = b.enc ? `tagebuch_${b.date}.db.enc` : `tagebuch_${b.date}.db`;
    await fetch(buildUrl(filename), {
      method: 'DELETE',
      headers: { Authorization: `Basic ${credentials}` },
    }).catch(() => {});
  }
  if (toDelete.length > 0) await appendLog('info', `${toDelete.length} altes Backup(s) gelöscht`);

  await saveWebdavBackups(toKeep);
}

export async function listWebdavBackups(): Promise<BackupEntry[]> {
  return getWebdavBackups();
}

export async function restoreFromVersionWebdav(entry: BackupEntry): Promise<void> {
  await appendLog('info', `Restore Version ${entry.date} gestartet`);
  const config = await loadConfig();
  if (!config.url || !config.username || !config.password) throw new Error('Nextcloud nicht konfiguriert.');

  if (entry.enc) {
    const key = await exportEncKey();
    if (!key) {
      throw new Error(
        'Backup ist verschlüsselt, aber kein Schlüssel vorhanden.\n\n' +
          'Einstellungen → Sicherheit → Schlüssel exportieren (Gerät 1) → Schlüssel importieren (dieses Gerät).',
      );
    }
  }

  const credentials = btoa(`${config.username}:${config.password}`);
  const base = config.url.replace(/\/$/, '');
  const dir = (config.path ?? '/Tagebuch/').replace(/\/$/, '');
  const buildUrl = (filename: string) => buildWebDavUrl(base, dir, config.username!, filename);
  const filename = entry.enc ? `tagebuch_${entry.date}.db.enc` : `tagebuch_${entry.date}.db`;

  const tempPath = `${cacheDirectory ?? ''}tagebuch_version_restore.tmp`;
  await appendLog('info', `Lade Backup ${filename}…`);
  let dl: { status: number };
  try {
    dl = await downloadAsync(buildUrl(filename), tempPath, { headers: { Authorization: `Basic ${credentials}` } });
  } catch (e: any) {
    await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
    throw new Error(`Netzwerkfehler: ${e?.message ?? String(e)}`);
  }
  if (dl.status !== 200) {
    await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
    throw new Error(dl.status === 401 ? 'Authentifizierung fehlgeschlagen.' : `HTTP ${dl.status}`);
  }

  try {
    await applyRestore(tempPath, entry.enc);
  } catch (e: any) {
    const msg = `Fehler beim Ersetzen der DB: ${e?.message ?? String(e)}`;
    await appendLog('error', msg);
    throw new Error(msg);
  } finally {
    await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
  }

  await appendLog('info', `Restore Version ${entry.date} erfolgreich`);
}

export async function pushNow(): Promise<void> {
  if (!acquireSyncLock()) return;
  try {
    await _doPush();
    _notifySyncListeners();
  } finally {
    releaseSyncLock();
  }
}

async function _doPush(): Promise<void> {
  await appendLog('info', 'Push gestartet (lokale DB → Remote)');
  const config = await loadConfig();
  if (!config.url || !config.username || !config.password) {
    const msg = 'Nextcloud nicht konfiguriert.';
    await appendLog('error', msg);
    throw new Error(msg);
  }

  const rawDbPath = await getDbPath();
  const dbPath = rawDbPath.startsWith('file://') ? rawDbPath : `file://${rawDbPath}`;
  const credentials = btoa(`${config.username}:${config.password}`);
  const base = config.url.replace(/\/$/, '');
  const dir = (config.path ?? '/Tagebuch/').replace(/\/$/, '');
  const buildUrl = (filename: string) => buildWebDavUrl(base, dir, config.username!, filename);

  await _uploadWebdav(rawDbPath, dbPath, credentials, buildUrl);
  await appendLog('info', 'Push erfolgreich');
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

  await appendLog('info', 'Ersetze Datei…');
  try {
    await applyRestore(tempPath, isEncFile);
  } catch (e: any) {
    const msg = `Fehler beim Ersetzen der DB: ${e?.message ?? String(e)}`;
    await appendLog('error', msg);
    throw new Error(msg);
  } finally {
    await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
  }

  await appendLog('info', 'Restore erfolgreich');
}
