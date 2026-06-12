# Tagebuch v2.10.0

## Security & Stability (major update)

### Encryption
- **TGBv3**: AES-256-GCM replaces AES-CBC for all new uploads — stronger authenticity, no padding attacks possible
- Older backups (TGBv2, legacy format) continue to decrypt (backwards compatible)
- **PBKDF2** (100,000 iterations) replaces unsalted SHA-256 for the biometric lock fallback password
  - Existing passwords are automatically migrated on next login

### Sync
- **Atomic WebDAV upload**: PUT → MOVE prevents partial files on the server
- **Lost-update protection**: ETag checks (WebDAV) and headRevisionId checks (Google Drive) prevent concurrent changes from being silently overwritten
- Background sync: Nextcloud and Google Drive are now synced sequentially instead of in parallel — prevents DB corruption
- Merge logic: removed tags/categories are no longer incorrectly restored when older remote entries are synced

### Backup & Restore
- **Restore safety**: integrity check of the downloaded DB before replacing; automatic rollback to a pre-restore backup on failure
- **Backup rotation**: daily automatic snapshots with configurable retention (3–30 days)
- Older versions restorable via Settings → Sync & Backup → Older Versions

### Android hardening
- Screenshots and screen recordings blocked (FLAG_SECURE)
- `allowBackup: false` — excludes the database from Android system backups
- PKCE (S256) for the Google OAuth flow

### Web client
- Credentials optionally stored only for the current browser session (sessionStorage) — nothing persists in localStorage after the tab is closed
- "Remember me" checkbox on the login screen

### Proxy security (Nextcloud WebDAV relay)
- SSRF protection: private IP addresses are blocked
- DNS rebinding protection: validated IP is pinned to the curl request
- Rate limiting: 120 requests per 60 seconds per IP subnet
