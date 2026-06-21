## v2.10.13

- Backup list: now fetched directly from server (WebDAV PROPFIND / Google Drive API) instead of local cache
- Database export: WAL checkpoint before copy — exported DB is always complete
- Version restore Google Drive: folder ID is now correctly passed through
- Local date used for backup filenames (instead of UTC) — no more wrong date when syncing just after midnight
