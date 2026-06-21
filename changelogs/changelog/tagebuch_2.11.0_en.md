# Tagebuch v2.11.0

## Google Drive completely reworked

### New OAuth flow (Android)
- Android now uses the same web client ID as the web client — token exchange happens securely via the server-side proxy, no `client_secret` on the device
- PKCE (code challenge) protection for the authorization flow
- Redirect via `proxy.php?action=oauth_callback` → app's custom URI scheme

### Reduced Drive access (security)
- Web client now uses `drive.file` instead of the full `drive` scope — access only to files created by the app itself
- Android and web share the same app identity → mutual visibility of the sync file

### Improved folder picker
- Folder picker opens as a full-screen sheet (no more clipped dialog)
- "Select this folder" button and navigation always visible (safe area inset, explicit label)

## Web client

- **Save without conflict errors**: False `ConflictError` on save fixed (ETag/revision check removed — it always triggered due to format inconsistency)
- **Sync timestamp survives reload**: Last sync time (Nextcloud + Drive) is now stored in `localStorage` and survives hard page reloads

## Security & stability

- Lock password and recovery code: PBKDF2 with salt (100,000 iterations) instead of SHA-256 — existing hashes are automatically migrated on next login
- Android OAuth: PKCE challenge for all Drive authorizations
- Background sync: Nextcloud and Google Drive are now synced sequentially with separate error handling (Drive was previously never executed when the sync lock was active)
