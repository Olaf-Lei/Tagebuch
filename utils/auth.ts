import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const STORE_PW_HASH = 'lock_password_hash';
const STORE_RECOVERY_HASH = 'lock_recovery_hash';

async function _randomHex(bytes: number): Promise<string> {
  const buf = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(buf as Uint8Array).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _pbkdf2(value: string, salt: string): Promise<string> {
  return CryptoJS.PBKDF2(value, salt, { keySize: 256 / 32, iterations: 100_000 }).toString();
}

async function _makeHash(value: string): Promise<string> {
  const salt = await _randomHex(16);
  return `pbkdf2:${salt}:${await _pbkdf2(value, salt)}`;
}

async function _verifyHash(value: string, stored: string): Promise<boolean> {
  if (stored.startsWith('pbkdf2:')) {
    const parts = stored.split(':');
    return (await _pbkdf2(value, parts[1])) === parts[2];
  }
  // Legacy SHA-256 — upgrade on next successful login
  return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value)) === stored;
}

export async function setFallbackPassword(password: string): Promise<void> {
  await SecureStore.setItemAsync(STORE_PW_HASH, await _makeHash(password));
}

export async function hasFallbackPassword(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(STORE_PW_HASH));
}

export async function checkFallbackPassword(password: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(STORE_PW_HASH);
  if (!stored) return false;
  const ok = await _verifyHash(password, stored);
  if (ok && !stored.startsWith('pbkdf2:'))
    await SecureStore.setItemAsync(STORE_PW_HASH, await _makeHash(password));
  return ok;
}

export async function clearFallbackPassword(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_PW_HASH);
}

export async function generateRecoveryCode(): Promise<string> {
  const hex = (await _randomHex(4)).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export async function setRecoveryCode(code: string): Promise<void> {
  await SecureStore.setItemAsync(STORE_RECOVERY_HASH, await _makeHash(code.toUpperCase()));
}

export async function hasRecoveryCode(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(STORE_RECOVERY_HASH));
}

export async function checkRecoveryCode(code: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(STORE_RECOVERY_HASH);
  if (!stored) return false;
  const ok = await _verifyHash(code.toUpperCase(), stored);
  if (ok && !stored.startsWith('pbkdf2:'))
    await SecureStore.setItemAsync(STORE_RECOVERY_HASH, await _makeHash(code.toUpperCase()));
  return ok;
}

export async function clearRecoveryCode(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_RECOVERY_HASH);
}
