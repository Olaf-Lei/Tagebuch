## v2.10.16

- Gemeinsame Sync-Pipeline extrahiert (`sync/syncPipeline.ts`): Integrity-Check, WAL-Checkpoint, Verschlüsselung, Restore-Logik werden von WebDAV und Google Drive gemeinsam genutzt — eliminiert ~70 Zeilen Duplikation
