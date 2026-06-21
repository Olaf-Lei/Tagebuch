## v2.10.14

- Relay-Code (Einmalcode) jetzt Ende-zu-Ende verschlüsselt: Server speichert nur AES-256-GCM-Ciphertext, der Schlüssel verlässt das Gerät nie — auch ein kompromittierter Server kann Zugangsdaten nicht lesen
- Code-Format geändert zu `CODE-Schlüssel` (Code bleibt 6 Zeichen, Schlüssel ist der 64-stellige Entschlüsselungsschlüssel)
