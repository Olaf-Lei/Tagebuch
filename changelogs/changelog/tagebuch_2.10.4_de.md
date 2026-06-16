# Tagebuch v2.10.4

## Bugfix

- **Cloud-Restore repariert**: Datenbank aus Nextcloud oder Google Drive wiederherstellen schlug mit dem Fehler „[fromCombined] Cannot convert …" fehl

## Neue Funktionen

- **Backup & Restore neu strukturiert**: Einstellungen → Sync & Backup zeigt jetzt drei klare Bereiche: Lokal, Google Drive, Nextcloud — jeweils mit Backup- und Restore-Aktionen sowie Auto-Sync
- **DB-Datei importieren**: Beliebige `.db`- oder `.db.enc`-Datei aus dem Gerätespeicher (inkl. gemounteter Drive/Nextcloud-Ordner) als Datenbank einspielen
- **Sync-Einstellungen im Backup**: Nextcloud-URL, -Zugangsdaten, Auto-Sync-Intervall und Aufbewahrungsdauer werden in der Datenbank gespeichert und beim Restore automatisch wiederhergestellt
