# Tagebuch v2.10.8

## Neues Feature

- **Lokales Backup**: Die App legt täglich automatisch ein lokales Backup der Datenbank ab (in `app/backups/`). In den Einstellungen → „Lokales Backup" können ältere Versionen wiederhergestellt oder eine externe `.db`- bzw. `.db.enc`-Datei importiert werden. Die Aufbewahrungsdauer (3/7/14/30 Tage) ist einstellbar.

## Verbesserung

- **Einstellungen überleben Restore**: WebDAV-Zugangsdaten, Sync-Intervall und Backup-Aufbewahrung werden jetzt zusätzlich in der SQLite-Datenbank gespeichert und nach einem Datenbank-Restore automatisch in den SecureStore zurückgespielt.

## Bugfixes

- **FLAG_SECURE zuverlässig**: `expo-screen-capture` war bisher nicht als natives Plugin eingebunden, sodass Screenshots und App-Switcher-Vorschau trotz aktivierter Einstellung nicht blockiert wurden. Das Plugin ist jetzt korrekt installiert.
- **TGBv3 Entschlüsselung (Android)**: Auf einigen Geräten schlug das Entschlüsseln von TGBv3-Backups fehl, weil die native Bibliothek ein `Uint8Array` statt eines Base64-Strings erwartet.
