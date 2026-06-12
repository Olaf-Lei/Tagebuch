# Tagebuch v2.10.0

## Sicherheit & Stabilität (großes Update)

### Verschlüsselung
- **TGBv3**: AES-256-GCM ersetzt AES-CBC für alle neuen Uploads — stärkere Authentizität, kein Padding-Angriff möglich
- Ältere Backups (TGBv2, Legacy-Format) werden weiterhin gelesen (Abwärtskompatibilität)
- **PBKDF2** (100.000 Iterationen) ersetzt ungesalzenes SHA-256 für den Biometrie-Lock-Fallback-Passwort
  - Bestehende Passwörter werden beim nächsten Login automatisch auf das neue Format migriert

### Sync
- **Atomarer WebDAV-Upload**: PUT → MOVE verhindert halbfertige Dateien auf dem Server
- **Lost-Update-Schutz**: ETag-Prüfung (WebDAV) und headRevisionId-Prüfung (Google Drive) verhindern, dass parallele Änderungen überschrieben werden
- Hintergrund-Sync: Nextcloud und Google Drive werden sequenziell statt parallel synchronisiert — verhindert DB-Korrumpierung
- Merge-Logik: Entfernte Tags/Kategorien werden nicht mehr irrtümlich wiederhergestellt, wenn ältere Remote-Einträge synchronisiert werden

### Datensicherung
- **Restore-Safety**: Integritätsprüfung der heruntergeladenen DB vor dem Ersetzen; automatischer Rollback auf ein Vor-Restore-Backup bei Fehler
- **Backup-Rotation**: Tägliche automatische Sicherungskopien mit konfigurierbarer Aufbewahrungsdauer (3–30 Tage)
- Ältere Versionen wiederherstellbar über Einstellungen → Sync & Backup → Ältere Versionen

### Android-Hardening
- Screenshots und Bildschirmaufnahmen gesperrt (FLAG_SECURE)
- `allowBackup: false` — schließt Datenbank aus dem Android-System-Backup aus
- PKCE (S256) für den Google-OAuth-Flow

### Web-Client
- Credentials optional nur für die aktuelle Browser-Sitzung gespeichert (sessionStorage) — kein Verbleib im localStorage nach Tab-Schließen
- "Angemeldet bleiben"-Checkbox auf dem Anmeldebildschirm

### Proxy-Sicherheit (Nextcloud-WebDAV-Relay)
- SSRF-Schutz: Private IP-Adressen werden geblockt
- DNS-Rebinding-Schutz: Validierte IP wird an curl gepinnt
- Rate-Limiting: 120 Anfragen pro 60 Sekunden pro IP-Subnetz
