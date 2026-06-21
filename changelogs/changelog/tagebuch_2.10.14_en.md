## v2.10.14

- Relay code (one-time code) is now end-to-end encrypted: server stores only AES-256-GCM ciphertext, the key never leaves the device — even a compromised server cannot read credentials
- Code format changed to `CODE-KEY` (code remains 6 characters, key is the 64-character decryption key)
