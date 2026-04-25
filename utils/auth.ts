import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const STORE_PW_HASH = 'lock_password_hash';

async function hash(password: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
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
