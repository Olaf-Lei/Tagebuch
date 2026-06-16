# Tagebuch v2.10.4

## Bug Fix

- **Cloud restore fixed**: Restoring the database from Nextcloud or Google Drive failed with "[fromCombined] Cannot convert …"

## New Features

- **Backup & Restore restructured**: Settings → Sync & Backup now shows three clear sections: Local, Google Drive, Nextcloud — each with backup and restore actions plus auto-sync
- **Import DB file**: Import any `.db` or `.db.enc` file from device storage (including mounted Drive/Nextcloud folders) as the active database
- **Sync settings in backup**: Nextcloud URL, credentials, auto-sync interval and retention period are stored in the database and automatically restored on import
