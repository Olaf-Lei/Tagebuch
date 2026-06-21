## v2.10.15

- Sync-Metadaten (Zeitstempel, Ordner-IDs, Backup-Listen) aus SecureStore in die SQLite-Konfigurationstabelle verschoben — behebt potenzielles 4 KB-Limit bei langen Backup-Listen
- Tombstone-Pruning: Lösch-Tombstones älter als 365 Tage werden nach jedem Sync automatisch bereinigt
