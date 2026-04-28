import {
  downloadAsync,
  uploadAsync,
  deleteAsync,
  copyAsync,
  cacheDirectory,
  FileSystemUploadType,
} from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { getDbPath, closeDb, initDb, getDb } from '../db/schema';
import { isEncryptionEnabled, encryptDbToTemp, decryptToPath, exportEncKey } from '../utils/crypto';
import { appendLog } from './syncLog';
import { mergeRemoteDb } from './mergeDb';

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const REDIRECT_URI = 'com.googleusercontent.apps.YOUR_GOOGLE_CLIENT_ID:/oauth2redirect';
const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

const STORE_ACCESS_TOKEN = 'gdrive_access_token';
const STORE_REFRESH_TOKEN = 'gdrive_refresh_token';
const STORE_TOKEN_EXPIRY = 'gdrive_token_expiry';
const STORE_FILE_ID_DB = 'gdrive_file_id_db';
const STORE_FILE_ID_ENC = 'gdrive_file_id_enc';
const STORE_LAST_SYNC = 'gdrive_last_sync';
const STORE_LAST_SYNC_MS = 'gdrive_last_sync_ms';
const STORE_EMAIL = 'gdrive_email';
const STORE_FOLDER_ID = 'gdrive_folder_id';
const STORE_FOLDER_NAME = 'gdrive_folder_name';

function _encodeForm(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export async function isConnected(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(STORE_REFRESH_TOKEN);
  return !!token;
}

export async function getConnectedEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(STORE_EMAIL);
}

export async function getLastSync(): Promise<string | null> {
  return SecureStore.getItemAsync(STORE_LAST_SYNC);
}

export async function getLastSyncMs(): Promise<number | null> {
  const v = await SecureStore.getItemAsync(STORE_LAST_SYNC_MS);
  return v ? Number(v) : null;
}

export async function getDriveFolder(): Promise<{ id: string; name: string } | null> {
  const id = await SecureStore.getItemAsync(STORE_FOLDER_ID);
  const name = await SecureStore.getItemAsync(STORE_FOLDER_NAME);
  if (!id || !name) return null;
  return { id, name };
}

export async function setDriveFolder(id: string, name: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(STORE_FOLDER_ID, id),
    SecureStore.setItemAsync(STORE_FOLDER_NAME, name),
    SecureStore.deleteItemAsync(STORE_FILE_ID_DB).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_FILE_ID_ENC).catch(() => {}),
  ]);
}

export async function clearDriveFolder(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORE_FOLDER_ID).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_FOLDER_NAME).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_FILE_ID_DB).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_FILE_ID_ENC).catch(() => {}),
  ]);
}

export async function listDriveFolders(): Promise<{ id: string; name: string }[]> {
  const accessToken = await _getValidAccessToken();
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false");
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) throw new Error(`Ordner-Liste fehlgeschlagen: ${response.status}`);
  const data = await response.json();
  return (data.files ?? []) as { id: string; name: string }[];
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

async function _refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: _encodeForm({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token-Refresh fehlgeschlagen: ${text}`);
  }
  const tokens = await response.json();
  const expiry = Date.now() + tokens.expires_in * 1000;
  await SecureStore.setItemAsync(STORE_ACCESS_TOKEN, tokens.access_token);
  await SecureStore.setItemAsync(STORE_TOKEN_EXPIRY, String(expiry));
  return tokens.access_token as string;
}

async function _getValidAccessToken(): Promise<string> {
  const [accessToken, refreshToken, expiryStr] = await Promise.all([
    SecureStore.getItemAsync(STORE_ACCESS_TOKEN),
    SecureStore.getItemAsync(STORE_REFRESH_TOKEN),
    SecureStore.getItemAsync(STORE_TOKEN_EXPIRY),
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
  fileIdStoreKey: string,
  folderId?: string,
): Promise<void> {
  let fileId = await SecureStore.getItemAsync(fileIdStoreKey);
  let uploadUrl: string;
  try {
    uploadUrl = await _getResumableUploadUrl(accessToken, filename, fileId, folderId);
  } catch (e: any) {
    if (fileId && String(e.message).includes('404')) {
      await SecureStore.deleteItemAsync(fileIdStoreKey).catch(() => {});
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
      if (body.id) await SecureStore.setItemAsync(fileIdStoreKey, body.id as string);
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
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    `client_id=${encodeURIComponent(CLIENT_ID)}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(SCOPE)}&` +
    `access_type=offline&` +
    `prompt=consent`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);
  if (result.type !== 'success') throw new Error('Authentifizierung abgebrochen.');

  const codeMatch = result.url.match(/[?&]code=([^&]+)/);
  if (!codeMatch) throw new Error('Kein Autorisierungscode empfangen.');
  const code = decodeURIComponent(codeMatch[1]);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: _encodeForm({
      code,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Token-Austausch fehlgeschlagen: ${text}`);
  }
  const tokens = await tokenResponse.json();
  const expiry = Date.now() + tokens.expires_in * 1000;

  await Promise.all([
    SecureStore.setItemAsync(STORE_ACCESS_TOKEN, tokens.access_token as string),
    SecureStore.setItemAsync(STORE_REFRESH_TOKEN, (tokens.refresh_token as string) ?? ''),
    SecureStore.setItemAsync(STORE_TOKEN_EXPIRY, String(expiry)),
  ]);

  try {
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (userInfo.ok) {
      const info = await userInfo.json();
      if (info.email) await SecureStore.setItemAsync(STORE_EMAIL, info.email as string);
    }
  } catch {}
}

export async function signOut(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORE_ACCESS_TOKEN).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_REFRESH_TOKEN).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_TOKEN_EXPIRY).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_FILE_ID_DB).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_FILE_ID_ENC).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_LAST_SYNC).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_LAST_SYNC_MS).catch(() => {}),
    SecureStore.deleteItemAsync(STORE_EMAIL).catch(() => {}),
  ]);
}

export async function syncIfConfigured(): Promise<void> {
  const connected = await isConnected();
  if (!connected) return;
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
  remoteFileId = await SecureStore.getItemAsync(STORE_FILE_ID_ENC) ?? await _findFile('tagebuch.db.enc', accessToken, folderId);
  if (remoteFileId) {
    remoteIsEnc = true;
    await SecureStore.setItemAsync(STORE_FILE_ID_ENC, remoteFileId);
    await appendLog('info', 'Verschlüsselte Remote-DB gefunden.');
  } else {
    remoteFileId = await SecureStore.getItemAsync(STORE_FILE_ID_DB) ?? await _findFile('tagebuch.db', accessToken, folderId);
    if (remoteFileId) {
      await SecureStore.setItemAsync(STORE_FILE_ID_DB, remoteFileId);
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

  const db = await getDb();
  await db.execAsync(`PRAGMA wal_checkpoint(TRUNCATE)`);

  const encrypted = await isEncryptionEnabled();
  const uploadFilename = encrypted ? 'tagebuch.db.enc' : 'tagebuch.db';
  const fileIdStoreKey = encrypted ? STORE_FILE_ID_ENC : STORE_FILE_ID_DB;

  let uploadPath = rawDbPath;
  let tempUpPath: string | null = null;
  if (encrypted) {
    try {
      tempUpPath = await encryptDbToTemp(rawDbPath);
      uploadPath = tempUpPath;
    } catch (e: any) {
      const msg = `Verschlüsselung fehlgeschlagen: ${e?.message ?? String(e)}`;
      await appendLog('error', msg);
      throw new Error(msg);
    }
  }

  await appendLog('info', `Upload: ${uploadFilename}`);
  try {
    await _uploadFile(accessToken, uploadPath, uploadFilename, fileIdStoreKey, folderId);
  } catch (e: any) {
    const msg = `Upload fehlgeschlagen: ${e?.message ?? String(e)}`;
    await appendLog('error', msg);
    throw new Error(msg);
  } finally {
    if (tempUpPath) await deleteAsync(`file://${tempUpPath}`, { idempotent: true }).catch(() => {});
  }

  const now = new Date().toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  await SecureStore.setItemAsync(STORE_LAST_SYNC, now);
  await SecureStore.setItemAsync(STORE_LAST_SYNC_MS, String(Date.now()));
  await appendLog('info', 'Google Drive Sync erfolgreich');
}

export async function restoreNow(): Promise<void> {
  await appendLog('info', 'Google Drive Restore gestartet');
  const accessToken = await _getValidAccessToken();

  let fileId: string | null = null;
  let isEncFile = false;

  const encId = await SecureStore.getItemAsync(STORE_FILE_ID_ENC) ?? await _findFile('tagebuch.db.enc', accessToken);
  if (encId) {
    fileId = encId;
    isEncFile = true;
  } else {
    const plainId = await SecureStore.getItemAsync(STORE_FILE_ID_DB) ?? await _findFile('tagebuch.db', accessToken);
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
  await appendLog('info', 'Google Drive Restore erfolgreich');
}
