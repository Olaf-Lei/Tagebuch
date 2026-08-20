import {
  downloadAsync,
  uploadAsync,
  deleteAsync,
  cacheDirectory,
  FileSystemUploadType,
} from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import * as ExpoC from 'expo-crypto';
import { getDbPath } from '../db/schema';
import { appendLog } from './syncLog';
import { mergeRemoteDb } from './mergeDb';
import { GDRIVE_CLIENT_ID as CLIENT_ID, GDRIVE_REDIRECT_URI as REDIRECT_URI, GDRIVE_PROXY_BASE } from './googledriveConfig';
import { acquireSyncLock, releaseSyncLock, setSyncError } from './syncState';
import {
  checkIntegrityAndCheckpoint,
  prepareUpload,
  syncTimestamp,
  checkEncKey,
  applyRestoreWithCleanup,
} from './syncPipeline';
import {
  todayStr,
  cutoffStr,
  getRetentionDays,
  getDriveBackups,
  saveDriveBackups,
  type DriveBackupEntry,
} from './backupRotation';
import { getConfig, setConfig, deleteConfig, type ConfigKey } from '../db/config';

const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.email';

const STORE_ACCESS_TOKEN = 'gdrive_access_token';
const STORE_REFRESH_TOKEN = 'gdrive_refresh_token';

function _b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function _pkceVerifierAndChallenge(): Promise<{ verifier: string; challenge: string }> {
  const verifier = _b64url(await ExpoC.getRandomBytesAsync(32) as Uint8Array);
  const b64 = await ExpoC.digestStringAsync(
    ExpoC.CryptoDigestAlgorithm.SHA256, verifier, { encoding: ExpoC.CryptoEncoding.BASE64 });
  const challenge = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { verifier, challenge };
}

export async function isConnected(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(STORE_REFRESH_TOKEN);
  return !!token;
}

export async function getConnectedEmail(): Promise<string | null> {
  return getConfig('gdrive_email');
}

export async function getLastSync(): Promise<string | null> {
  return getConfig('gdrive_last_sync');
}

export async function getLastSyncMs(): Promise<number | null> {
  const v = await getConfig('gdrive_last_sync_ms');
  return v ? Number(v) : null;
}

export async function getDriveFolder(): Promise<{ id: string; name: string } | null> {
  const [id, name] = await Promise.all([getConfig('gdrive_folder_id'), getConfig('gdrive_folder_name')]);
  if (!id || !name) return null;
  return { id, name };
}

export async function setDriveFolder(id: string, name: string): Promise<void> {
  await Promise.all([
    setConfig('gdrive_folder_id', id),
    setConfig('gdrive_folder_name', name),
    deleteConfig('gdrive_file_id_db').catch(() => {}),
    deleteConfig('gdrive_file_id_enc').catch(() => {}),
  ]);
}

export async function clearDriveFolder(): Promise<void> {
  await Promise.all([
    deleteConfig('gdrive_folder_id').catch(() => {}),
    deleteConfig('gdrive_folder_name').catch(() => {}),
    deleteConfig('gdrive_file_id_db').catch(() => {}),
    deleteConfig('gdrive_file_id_enc').catch(() => {}),
  ]);
}

export async function createDriveFolder(name: string, parentId: string = 'root'): Promise<{ id: string; name: string }> {
  const accessToken = await _getValidAccessToken();
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  if (!response.ok) throw new Error(`Ordner anlegen fehlgeschlagen: ${response.status}`);
  const data = await response.json();
  return { id: data.id as string, name: data.name as string };
}

export async function listDriveFolders(parentId: string = 'root'): Promise<{ id: string; name: string }[]> {
  const accessToken = await _getValidAccessToken();
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents`);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) throw new Error(`Ordner-Liste fehlgeschlagen: ${response.status}`);
  const data = await response.json();
  return (data.files ?? []) as { id: string; name: string }[];
}

const _syncListeners: Set<() => void> = new Set();

export function addSyncListener(cb: () => void): () => void {
  _syncListeners.add(cb);
  return () => _syncListeners.delete(cb);
}

function _notifySyncListeners() {
  _syncListeners.forEach((cb) => cb());
}

async function _refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(`${GDRIVE_PROXY_BASE}?action=google_refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token-Refresh fehlgeschlagen: ${text}`);
  }
  const tokens = await response.json();
  if (tokens.error) throw new Error(tokens.error_description ?? tokens.error);
  const expiry = Date.now() + tokens.expires_in * 1000;
  await SecureStore.setItemAsync(STORE_ACCESS_TOKEN, tokens.access_token);
  await setConfig('gdrive_token_expiry', String(expiry));
  return tokens.access_token as string;
}

async function _getValidAccessToken(): Promise<string> {
  const [accessToken, refreshToken, expiryStr] = await Promise.all([
    SecureStore.getItemAsync(STORE_ACCESS_TOKEN),
    SecureStore.getItemAsync(STORE_REFRESH_TOKEN),
    getConfig('gdrive_token_expiry'),
  ]);
  if (!refreshToken) throw new Error('Nicht mit Google Drive verbunden.');
  const expiry = expiryStr ? Number(expiryStr) : 0;
  if (accessToken && Date.now() < expiry - 60_000) return accessToken;
  return _refreshAccessToken(refreshToken);
}

async function _findFile(filename: string, accessToken: string, folderId?: string): Promise<string | null> {
  let query = `name='${filename}' and trashed=false`;
  if (folderId) query += ` and '${folderId}' in parents`;
  const q = encodeURIComponent(query);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) return null;
  const data = await response.json();
  return (data.files?.[0]?.id as string) ?? null;
}

async function _getResumableUploadUrl(
  accessToken: string,
  filename: string,
  fileId: string | null,
  folderId?: string,
): Promise<string> {
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=resumable`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
  const metadata: Record<string, unknown> = { name: filename, mimeType: 'application/octet-stream' };
  if (!fileId && folderId) metadata.parents = [folderId];
  const response = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/octet-stream',
    },
    body: JSON.stringify(metadata),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive-Upload Init fehlgeschlagen (${response.status}): ${text}`);
  }
  const location = response.headers.get('Location');
  if (!location) throw new Error('Kein Upload-URL in der Antwort.');
  return location;
}

async function _uploadFile(
  accessToken: string,
  localPath: string,
  filename: string,
  configKey: ConfigKey,
  folderId?: string,
): Promise<void> {
  let fileId = await getConfig(configKey);
  let uploadUrl: string;
  try {
    uploadUrl = await _getResumableUploadUrl(accessToken, filename, fileId, folderId);
  } catch (e: any) {
    if (fileId && String(e.message).includes('404')) {
      await deleteConfig(configKey).catch(() => {});
      fileId = null;
      uploadUrl = await _getResumableUploadUrl(accessToken, filename, null, folderId);
    } else {
      throw e;
    }
  }
  const filePath = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
  const result = await uploadAsync(uploadUrl, filePath, {
    httpMethod: 'PUT',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  if (result.status >= 300) throw new Error(`Drive-Upload fehlgeschlagen: ${result.status}`);
  if (!fileId) {
    try {
      const body = JSON.parse(result.body ?? '{}');
      if (body.id) await setConfig(configKey, body.id as string);
    } catch {}
  }
}

async function _downloadFile(accessToken: string, fileId: string, destPath: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const dest = destPath.startsWith('file://') ? destPath : `file://${destPath}`;
  const result = await downloadAsync(url, dest, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (result.status !== 200) throw new Error(`Drive-Download fehlgeschlagen: ${result.status}`);
}

export async function authenticate(): Promise<void> {
  const { verifier, challenge } = await _pkceVerifierAndChallenge();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const result = await WebBrowser.openAuthSessionAsync(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`, 'tagebuch://oauth2redirect');
  if (result.type !== 'success') throw new Error('Authentifizierung abgebrochen.');

  const codeMatch = result.url.match(/[?&]code=([^&]+)/);
  if (!codeMatch) throw new Error('Kein Autorisierungscode empfangen.');
  const code = decodeURIComponent(codeMatch[1]);

  const tokenResponse = await fetch(`${GDRIVE_PROXY_BASE}?action=google_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: REDIRECT_URI, code_verifier: verifier }),
  });
  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Token-Austausch fehlgeschlagen: ${text}`);
  }
  const tokens = await tokenResponse.json();
  if (tokens.error) throw new Error(tokens.error_description ?? tokens.error);
  const expiry = Date.now() + tokens.expires_in * 1000;

  await Promise.all([
    SecureStore.setItemAsync(STORE_ACCESS_TOKEN, tokens.access_token as string),
    SecureStore.setItemAsync(STORE_REFRESH_TOKEN, (tokens.refresh_token as string) ?? ''),
    setConfig('gdrive_token_expiry', String(expiry)),
  ]);

  try {
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (userInfo.ok) {
      const info = await userInfo.json();
      if (info.email) await setConfig('gdrive_email', info.email as string);
    }
  } catch {}
}

export async function signOut(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORE_ACCESS_TOKEN).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_REFRESH_TOKEN).catch(() => {}),
    deleteConfig('gdrive_token_expiry').catch(() => {}),
    deleteConfig('gdrive_file_id_db').catch(() => {}),
    deleteConfig('gdrive_file_id_enc').catch(() => {}),
    deleteConfig('gdrive_last_sync').catch(() => {}),
    deleteConfig('gdrive_last_sync_ms').catch(() => {}),
    deleteConfig('gdrive_email').catch(() => {}),
  ]);
}

export async function syncIfConfigured(): Promise<void> {
  const connected = await isConnected();
  if (!connected) return;
  syncNow().catch(() => {});
}

export async function syncNow(): Promise<void> {
  if (!acquireSyncLock()) return;
  try {
    await setSyncError('gdrive', null);
    await _doSync();
    _notifySyncListeners();
  } catch (e: any) {
    await setSyncError('gdrive', e.message ?? String(e));
    throw e;
  } finally {
    releaseSyncLock();
  }
}

async function _doSync(): Promise<void> {
  await appendLog('info', 'Google Drive Sync gestartet');
  const accessToken = await _getValidAccessToken();

  const folderData = await getDriveFolder();
  const folderId = folderData?.id;

  const rawDbPath = await getDbPath();
  const dbDir = rawDbPath.substring(0, rawDbPath.lastIndexOf('/') + 1);
  const tempDownRaw = `${dbDir}tagebuch_gdrive_merge.tmp`;
  const tempDownPath = `file://${tempDownRaw}`;

  // Suche Remote-Datei: erst verschlüsselt, dann plain (wie WebDAV)
  let remoteFileId: string | null = null;
  let remoteIsEnc = false;

  await appendLog('info', 'Suche Remote-Backup in Google Drive…');
  remoteFileId = await getConfig('gdrive_file_id_enc') ?? await _findFile('tagebuch.db.enc', accessToken, folderId);
  if (remoteFileId) {
    remoteIsEnc = true;
    await setConfig('gdrive_file_id_enc', remoteFileId);
    await appendLog('info', 'Verschlüsselte Remote-DB gefunden.');
  } else {
    remoteFileId = await getConfig('gdrive_file_id_db') ?? await _findFile('tagebuch.db', accessToken, folderId);
    if (remoteFileId) {
      await setConfig('gdrive_file_id_db', remoteFileId);
      await appendLog('info', 'Unverschlüsselte Remote-DB gefunden.');
    } else {
      await appendLog('info', 'Kein Remote-Backup vorhanden — Erstsync.');
    }
  }

  if (remoteFileId) {
    try {
      await _downloadFile(accessToken, remoteFileId, tempDownRaw);
    } catch (e: any) {
      await deleteAsync(tempDownPath, { idempotent: true }).catch(() => {});
      const msg = `Download fehlgeschlagen: ${e.message}`;
      await appendLog('error', msg);
      throw new Error(msg);
    }
    try {
      await mergeRemoteDb(tempDownRaw, remoteIsEnc, dbDir);
    } finally {
      await deleteAsync(tempDownPath, { idempotent: true }).catch(() => {});
    }
  }

  await _uploadGDrive(accessToken, rawDbPath, folderId);
  await appendLog('info', 'Google Drive Sync erfolgreich');
}

async function _uploadGDrive(
  accessToken: string,
  rawDbPath: string,
  folderId: string | undefined,
): Promise<void> {
  await checkIntegrityAndCheckpoint();

  const { uploadPath, filename: uploadFilename, encrypted, cleanup } = await prepareUpload(rawDbPath);
  const fileIdStoreKey: ConfigKey = encrypted ? 'gdrive_file_id_enc' : 'gdrive_file_id_db';

  await appendLog('info', `Upload: ${uploadFilename}`);
  try {
    await _uploadFile(accessToken, uploadPath, uploadFilename, fileIdStoreKey, folderId);
  } catch (e: any) {
    const msg = `Upload fehlgeschlagen: ${e?.message ?? String(e)}`;
    await appendLog('error', msg);
    throw new Error(msg);
  } finally {
    await cleanup();
  }

  await _rotateDriveBackups(accessToken, encrypted, folderId).catch(async (e) => {
    await appendLog('warn', `Backup-Rotation fehlgeschlagen: ${e?.message ?? String(e)}`);
  });

  const now = syncTimestamp();
  await setConfig('gdrive_last_sync', now);
  await setConfig('gdrive_last_sync_ms', String(Date.now()));
}

async function _rotateDriveBackups(
  accessToken: string,
  encrypted: boolean,
  folderId: string | undefined,
): Promise<void> {
  const today = todayStr();
  const retention = await getRetentionDays();
  const backups = await getDriveBackups();

  if (!backups.find((b) => b.date === today)) {
    const mainFileId = await getConfig(encrypted ? 'gdrive_file_id_enc' : 'gdrive_file_id_db');
    if (mainFileId) {
      const backupName = encrypted ? `tagebuch_${today}.db.enc` : `tagebuch_${today}.db`;
      const meta: Record<string, unknown> = { name: backupName };
      if (folderId) meta.parents = [folderId];
      const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${mainFileId}/copy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(meta),
      });
      if (resp.ok) {
        const body = await resp.json();
        backups.unshift({ date: today, fileId: body.id as string, enc: encrypted });
        await appendLog('info', `Backup angelegt: ${backupName}`);
      }
    }
  }

  const cutoff = cutoffStr(retention);
  const toDelete = backups.filter((b) => b.date < cutoff);
  const toKeep = backups.filter((b) => b.date >= cutoff);

  for (const b of toDelete) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${b.fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
  }
  if (toDelete.length > 0) await appendLog('info', `${toDelete.length} altes Backup(s) gelöscht`);

  await saveDriveBackups(toKeep);
}

export async function listDriveBackups(): Promise<DriveBackupEntry[]> {
  try {
    const accessToken = await _getValidAccessToken();
    const folderData = await getDriveFolder();
    const folderId = folderData?.id;
    let q = `name contains 'tagebuch_' and trashed=false`;
    if (folderId) q += ` and '${folderId}' in parents`;
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=name%20desc&pageSize=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!resp.ok) return getDriveBackups();
    const data = await resp.json();
    const entries: DriveBackupEntry[] = [];
    for (const file of (data.files ?? []) as { id: string; name: string }[]) {
      const m = file.name.match(/^tagebuch_(\d{4}-\d{2}-\d{2})\.(db\.enc|db)$/);
      if (m) entries.push({ date: m[1], fileId: file.id, enc: m[2] === 'db.enc' });
    }
    if (entries.length > 0) {
      entries.sort((a, b) => b.date.localeCompare(a.date));
      return entries;
    }
    return getDriveBackups();
  } catch {
    return getDriveBackups();
  }
}

export async function restoreFromVersionDrive(entry: DriveBackupEntry): Promise<void> {
  await appendLog('info', `Google Drive Restore Version ${entry.date} gestartet`);

  if (entry.enc) await checkEncKey();

  const accessToken = await _getValidAccessToken();
  const tempPath = `${cacheDirectory ?? ''}tagebuch_gdrive_version_restore.tmp`;
  await appendLog('info', `Lade Backup vom ${entry.date}…`);
  try {
    await _downloadFile(accessToken, entry.fileId, tempPath);
  } catch (e: any) {
    await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
    throw e;
  }

  await applyRestoreWithCleanup(tempPath, entry.enc);
  await appendLog('info', `Google Drive Restore Version ${entry.date} erfolgreich`);
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
  await appendLog('info', 'Push gestartet (lokale DB → Google Drive)');
  const accessToken = await _getValidAccessToken();
  const folderData = await getDriveFolder();
  const rawDbPath = await getDbPath();
  await _uploadGDrive(accessToken, rawDbPath, folderData?.id);
  await appendLog('info', 'Push erfolgreich');
}

export async function restoreNow(): Promise<void> {
  await appendLog('info', 'Google Drive Restore gestartet');
  const accessToken = await _getValidAccessToken();
  const folderData = await getDriveFolder();
  const folderId = folderData?.id;

  let fileId: string | null = null;
  let isEncFile = false;

  const encId = await getConfig('gdrive_file_id_enc') ?? await _findFile('tagebuch.db.enc', accessToken, folderId);
  if (encId) {
    fileId = encId;
    isEncFile = true;
  } else {
    const plainId = await getConfig('gdrive_file_id_db') ?? await _findFile('tagebuch.db', accessToken, folderId);
    if (plainId) { fileId = plainId; isEncFile = false; }
  }

  if (!fileId) {
    const msg = 'Kein Backup in Google Drive gefunden. Zuerst synchronisieren.';
    await appendLog('error', msg);
    throw new Error(msg);
  }

  const tempPath = (cacheDirectory ?? '') + 'tagebuch_gdrive_restore.tmp';
  await appendLog('info', 'Lade Backup herunter…');
  await _downloadFile(accessToken, fileId, tempPath);

  await appendLog('info', 'Ersetze Datei…');
  await applyRestoreWithCleanup(tempPath, isEncFile);
  await appendLog('info', 'Google Drive Restore erfolgreich');
}
