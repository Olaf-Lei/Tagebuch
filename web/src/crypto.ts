import CryptoJS from 'crypto-js'

function _hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return bytes
}

async function _importAesKey(hexKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', _hexToBytes(hexKey), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function decryptDb(encryptedText: string, hexKey: string): Promise<ArrayBuffer> {
  if (encryptedText.startsWith('TGBv3:')) {
    const key = await _importAesKey(hexKey)
    const raw = Uint8Array.from(atob(encryptedText.slice(6)), c => c.charCodeAt(0))
    const iv = raw.slice(0, 12)
    const ciphertextAndTag = raw.slice(12)
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextAndTag)
  }

  // Legacy decrypt via CryptoJS (TGBv2 + OpenSSL format)
  const keyWA = CryptoJS.enc.Hex.parse(hexKey)
  let decrypted: CryptoJS.lib.WordArray
  if (encryptedText.startsWith('TGBv2:')) {
    const raw = CryptoJS.enc.Base64.parse(encryptedText.slice(6))
    const iv = CryptoJS.lib.WordArray.create(raw.words.slice(0, 4), 16)
    const ciphertext = CryptoJS.lib.WordArray.create(raw.words.slice(4), raw.sigBytes - 16)
    decrypted = CryptoJS.AES.decrypt({ ciphertext } as CryptoJS.lib.CipherParams, keyWA, { iv })
  } else {
    decrypted = CryptoJS.AES.decrypt(encryptedText, hexKey)
  }
  const base64 = decrypted.toString(CryptoJS.enc.Base64)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export async function encryptDb(dbBytes: Uint8Array, hexKey: string): Promise<string> {
  const key = await _importAesKey(hexKey)
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)))
  const buf = dbBytes.buffer.slice(dbBytes.byteOffset, dbBytes.byteOffset + dbBytes.byteLength) as ArrayBuffer
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf)
  // TGBv3: Base64(IV[12] + ciphertext + tag[16])
  const combined = new Uint8Array(12 + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), 12)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < combined.length; i += chunk) {
    binary += String.fromCharCode(...combined.subarray(i, i + chunk))
  }
  return 'TGBv3:' + btoa(binary)
}
