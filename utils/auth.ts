import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const STORE_PW_HASH = 'lock_password_hash';
const STORE_RECOVERY_HASH = 'lock_recovery_hash';

async function hash(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

export async function setFallbackPassword(password: string): Promise<void> {
  await SecureStore.setItemAsync(STORE_PW_HASH, await hash(password));
}

export async function hasFallbackPassword(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(STORE_PW_HASH));
}

export async function checkFallbackPassword(password: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(STORE_PW_HASH);
  if (!stored) return false;
  return (await hash(password)) === stored;
}

export async function clearFallbackPassword(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_PW_HASH);
}

export async function generateRecoveryCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(4);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export async function setRecoveryCode(code: string): Promise<void> {
  await SecureStore.setItemAsync(STORE_RECOVERY_HASH, await hash(code.toUpperCase()));
}

export async function hasRecoveryCode(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(STORE_RECOVERY_HASH));
}

export async function checkRecoveryCode(code: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(STORE_RECOVERY_HASH);
  if (!stored) return false;
  return (await hash(code.toUpperCase())) === stored;
}

export async function clearRecoveryCode(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_RECOVERY_HASH);
}
