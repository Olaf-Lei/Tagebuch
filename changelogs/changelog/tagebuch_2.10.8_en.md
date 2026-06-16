# Tagebuch v2.10.8

## New Feature

- **Local backup**: The app now automatically creates a daily local backup of the database (in `app/backups/`). Under Settings → "Local Backup" you can restore older versions or import an external `.db` or `.db.enc` file. Retention period (3/7/14/30 days) is configurable.

## Improvement

- **Settings survive restore**: WebDAV credentials, sync interval, and backup retention are now additionally stored in the SQLite database and automatically written back to SecureStore after a database restore.

## Bug Fixes

- **FLAG_SECURE reliable**: `expo-screen-capture` was not registered as a native plugin, so screenshots and app-switcher previews were not actually blocked despite the setting being active. The plugin is now correctly installed.
- **TGBv3 decryption (Android)**: On some devices, decrypting TGBv3 backups failed because the native library expects a `Uint8Array` instead of a Base64 string.
