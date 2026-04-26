import CryptoJS from 'crypto-js';
import {
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  cacheDirectory,
  EncodingType,
} from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import * as ExpoC from 'expo-crypto';

const STORE_ENC_ENABLED = 'enc_enabled';
const STORE_ENC_KEY = 'enc_key';

export async function isEncryptionEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(STORE_ENC_ENABLED);
  return v === 'true';
}

export async function setEncryptionEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(STORE_ENC_ENABLED, enabled ? 'true' : 'false');
  if (enabled) await getOrCreateKey();
}

export async function getOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(STORE_ENC_KEY);
  if (existing) return existing;
  const bytes = await ExpoC.getRandomBytesAsync(32);
  const key = Array.from(bytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(STORE_ENC_KEY, key);
  return key;
}

export async function resetEncryptionKey(): Promise<void> {
  const bytes = await ExpoC.getRandomBytesAsync(32);
  const key = Array.from(bytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(STORE_ENC_KEY, key);
}

export async function exportEncKey(): Promise<string | null> {
  return SecureStore.getItemAsync(STORE_ENC_KEY);
}

export async function importEncKey(hexKey: string): Promise<void> {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey.trim())) {
    throw new Error('invalid_key');
  }
  await SecureStore.setItemAsync(STORE_ENC_KEY, hexKey.trim().toLowerCase());
  await SecureStore.setItemAsync(STORE_ENC_ENABLED, 'true');
}

// Decrypts an encrypted file and writes the result to targetPath.
export async function decryptToPath(encPath: string, targetPath: string): Promise<void> {
  const key = await getOrCreateKey();
  const encUri = encPath.startsWith('file://') ? encPath : `file://${encPath}`;
  const outUri = targetPath.startsWith('file://') ? targetPath : `file://${targetPath}`;
  const encrypted = await readAsStringAsync(encUri, { encoding: EncodingType.UTF8 });
  const decrypted = CryptoJS.AES.decrypt(encrypted, key);
  const base64 = decrypted.toString(CryptoJS.enc.Base64);
  await writeAsStringAsync(outUri, base64, { encoding: EncodingType.Base64 });
}

// Returns path to encrypted temp file. Caller must delete after upload.
export async function encryptDbToTemp(dbPath: string): Promise<string> {
  const key = await getOrCreateKey();
  const uri = dbPath.startsWith('file://') ? dbPath : `file://${dbPath}`;
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  const wordArray = CryptoJS.enc.Base64.parse(base64);
  const encrypted = CryptoJS.AES.encrypt(wordArray, key).toString();
  const tempPath = cacheDirectory + 'tagebuch_upload.enc';
  await writeAsStringAsync(tempPath!, encrypted, { encoding: EncodingType.UTF8 });
  return tempPath!;
}
