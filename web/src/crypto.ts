import CryptoJS from 'crypto-js'

export function decryptDb(encryptedText: string, hexKey: string): ArrayBuffer {
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

export function encryptDb(dbBytes: Uint8Array, hexKey: string): string {
  // Large Uint8Array → btoa via chunk to avoid call stack overflow
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < dbBytes.length; i += chunk) {
    binary += String.fromCharCode(...dbBytes.subarray(i, i + chunk))
  }
  const wordArray = CryptoJS.enc.Base64.parse(btoa(binary))
  const keyWA = CryptoJS.enc.Hex.parse(hexKey)
  const iv = CryptoJS.lib.WordArray.random(16)
  const encrypted = CryptoJS.AES.encrypt(wordArray, keyWA, { iv })
  const combined = (iv.clone() as CryptoJS.lib.WordArray).concat(encrypted.ciphertext)
  return 'TGBv2:' + combined.toString(CryptoJS.enc.Base64)
}
