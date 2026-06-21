# Tagebuch v2.11.0

## Google Drive komplett überarbeitet

### Neues OAuth-Verfahren (Android)
- Android nutzt jetzt dieselbe Web-Client-ID wie der Web-Client — Token-Austausch erfolgt sicher über den serverseitigen Proxy, kein `client_secret` mehr auf dem Gerät
- PKCE-Absicherung (Code-Challenge) beim Autorisierungsfluss
- Redirect über `proxy.php?action=oauth_callback` → App-eigenes URI-Schema

### Reduzierter Drive-Zugriff (Sicherheit)
- Web-Client verwendet jetzt `drive.file` statt des vollen `drive`-Scopes — Zugriff nur noch auf Dateien, die die App selbst angelegt hat
- Android und Web nutzen dieselbe App-Identität → gegenseitige Sichtbarkeit der Sync-Datei

### Ordner-Auswahl verbessert
- Ordner-Picker öffnet als Vollbild-Sheet (kein abgeschnittener Dialog mehr)
- Buttons „Diesen Ordner wählen" und Navigation immer sichtbar (Safe-Area-Inset, explizite Beschriftung)

## Web-Client

- **Speichern ohne Konfliktfehler**: Falscher `ConflictError` beim Speichern behoben (ETag-/Revisions-Vergleich entfernt, der durch Format-Inkonsistenz immer anschlug)
- **Sync-Zeitstempel bleibt nach Reload**: Letzter Sync-Zeitpunkt (Nextcloud + Drive) wird jetzt in `localStorage` gespeichert und überlebt harte Seitenneuladen

## Sicherheit & Stabilität

- Lock-Passwort und Recovery-Code: PBKDF2 mit Salt (100.000 Iterationen) statt SHA-256 — bestehende Hashes werden beim nächsten Login automatisch migriert
- Android-OAuth: PKCE-Challenge für alle Drive-Autorisierungen
- Hintergrund-Sync: Nextcloud und Google Drive werden jetzt sequenziell mit eigenem Fehlerhandling synchronisiert (Drive wurde bisher bei aktivem Sync-Lock nie ausgeführt)
