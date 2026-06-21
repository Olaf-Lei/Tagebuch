## v2.10.13

- Backup-Liste: wird jetzt direkt vom Server (WebDAV PROPFIND / Google Drive API) geladen statt aus lokalem Cache
- Datenbankexport: WAL-Checkpoint vor dem Kopieren — exportierte DB ist immer vollständig
- Versions-Restore Google Drive: Ordner-ID wird korrekt berücksichtigt
- Lokales Datum für Backup-Dateinamen (statt UTC) — kein falsches Datum mehr bei Sync kurz nach Mitternacht
