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
import { AESEncryptionKey, AESSealedData, aesEncryptAsync, aesDecryptAsync } from 'expo-crypto';
import { setConfig } from '../db/config';

const STORE_ENC_ENABLED = 'enc_enabled';
const STORE_ENC_KEY = 'enc_key';

export async function isEncryptionEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(STORE_ENC_ENABLED);
  return v === 'true';
}

export async function setEncryptionEnabled(enabled: boolean): Promise<void> {
  const val = enabled ? 'true' : 'false';
  await SecureStore.setItemAsync(STORE_ENC_ENABLED, val);
  setConfig('enc_enabled', val).catch(() => {});
  if (enabled) await getOrCreateKey();
}

export async function getOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(STORE_ENC_KEY);
  if (existing) return existing;
  const bytes = await ExpoC.getRandomBytesAsync(32);
  const key = Array.from(bytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(STORE_ENC_KEY, key);
  setConfig('enc_key', key).catch(() => {});
  return key;
}

export async function resetEncryptionKey(): Promise<void> {
  const bytes = await ExpoC.getRandomBytesAsync(32);
  const key = Array.from(bytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(STORE_ENC_KEY, key);
  setConfig('enc_key', key).catch(() => {});
}

export async function exportEncKey(): Promise<string | null> {
  return SecureStore.getItemAsync(STORE_ENC_KEY);
}

export async function importEncKey(hexKey: string): Promise<void> {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey.trim())) {
    throw new Error('invalid_key');
  }
  const key = hexKey.trim().toLowerCase();
  await SecureStore.setItemAsync(STORE_ENC_KEY, key);
  await SecureStore.setItemAsync(STORE_ENC_ENABLED, 'true');
  setConfig('enc_key', key).catch(() => {});
  setConfig('enc_enabled', 'true').catch(() => {});
}

async function _importAesKey(hexKey: string): Promise<AESEncryptionKey> {
  return AESEncryptionKey.import(hexKey, 'hex');
}

// Decrypts an encrypted file. Supports TGBv3 (AES-GCM), TGBv2 (AES-CBC), Legacy (OpenSSL).
export async function decryptToPath(encPath: string, targetPath: string): Promise<void> {
  const hexKey = await getOrCreateKey();
  const encUri = encPath.startsWith('file://') ? encPath : `file://${encPath}`;
  const outUri = targetPath.startsWith('file://') ? targetPath : `file://${targetPath}`;
  const text = await readAsStringAsync(encUri, { encoding: EncodingType.UTF8 });

  let plainBase64: string;

  if (text.startsWith('TGBv3:')) {
    const key = await _importAesKey(hexKey);
    // Android native fromCombined requires ByteArray, not a base64 string
    const combinedBytes = Uint8Array.from(atob(text.slice(6).trim()), (c: string) => c.charCodeAt(0));
    const sealedData = AESSealedData.fromCombined(combinedBytes, { ivLength: 12, tagLength: 16 });
    const decrypted = await aesDecryptAsync(sealedData, key, { output: 'base64' });
    plainBase64 = decrypted;
  } else if (text.startsWith('TGBv2:')) {
    const keyWA = CryptoJS.enc.Hex.parse(hexKey);
    const raw = CryptoJS.enc.Base64.parse(text.slice(6));
    const iv = CryptoJS.lib.WordArray.create(raw.words.slice(0, 4), 16);
    const ciphertext = CryptoJS.lib.WordArray.create(raw.words.slice(4), raw.sigBytes - 16);
    const decrypted = CryptoJS.AES.decrypt({ ciphertext } as CryptoJS.lib.CipherParams, keyWA, { iv });
    plainBase64 = decrypted.toString(CryptoJS.enc.Base64);
  } else {
    // Legacy OpenSSL format
    const decrypted = CryptoJS.AES.decrypt(text, hexKey);
    plainBase64 = decrypted.toString(CryptoJS.enc.Base64);
  }

  await writeAsStringAsync(outUri, plainBase64, { encoding: EncodingType.Base64 });
}

// Encrypts the DB to a temp file using TGBv3 (AES-256-GCM). Caller must delete after upload.
export async function encryptDbToTemp(dbPath: string): Promise<string> {
  const hexKey = await getOrCreateKey();
  const key = await _importAesKey(hexKey);
  const uri = dbPath.startsWith('file://') ? dbPath : `file://${dbPath}`;
  const plainBase64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });

  // combined() gibt Base64(IV[12] + ciphertext + tag[16]) — genau das TGBv3-Format
  const sealedData = await aesEncryptAsync(plainBase64, key, { nonce: { length: 12 }, tagLength: 16 });
  const output = 'TGBv3:' + await sealedData.combined('base64');

  const tempPath = cacheDirectory + 'tagebuch_upload.enc';
  await writeAsStringAsync(tempPath!, output, { encoding: EncodingType.UTF8 });
  return tempPath!;
}

// Encrypts a relay payload with a fresh AES-256-GCM key. Caller sends only ct to the server;
// hexKey is shown to the user as the second part of the relay code (CODE-hexKey).
export async function encryptRelay(payload: Record<string, unknown>): Promise<{ ct: string; hexKey: string }> {
  const keyBytes = await ExpoC.getRandomBytesAsync(32) as Uint8Array;
  const hexKey = Array.from(keyBytes).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  const key = await _importAesKey(hexKey);
  const jsonStr = JSON.stringify(payload);
  const encoded = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < encoded.length; i++) binary += String.fromCharCode(encoded[i]);
  const sealed = await aesEncryptAsync(btoa(binary), key, { nonce: { length: 12 }, tagLength: 16 });
  return { ct: await sealed.combined('base64'), hexKey };
}
