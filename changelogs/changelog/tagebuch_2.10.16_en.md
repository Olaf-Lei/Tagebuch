## v2.10.16

- Extracted shared sync pipeline (`sync/syncPipeline.ts`): integrity check, WAL checkpoint, encryption, and restore logic are now shared between WebDAV and Google Drive — eliminates ~70 lines of duplication
