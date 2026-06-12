# Tagebuch 2.10 — Release Notes

Dieses Update dreht sich um eines: **deine Daten sollen sicher sein — und sicher bleiben.**

---

## Was ist neu?

### Stärkere Verschlüsselung
Wenn du Backups verschlüsselst, verwendet die App jetzt AES-256-GCM — einen moderneren Algorithmus, der zusätzlich sicherstellt, dass die Datei unterwegs nicht verändert wurde. Ältere Backups lassen sich natürlich weiterhin öffnen.

Auch dein App-Entsperr-Passwort wird ab sofort deutlich robuster gespeichert: statt eines einfachen Hashes kommt PBKDF2 mit 100.000 Rechenschritten zum Einsatz — das macht Brute-Force-Angriffe erheblich aufwendiger. Falls du ein Passwort gesetzt hast, wird es beim nächsten Entsperren automatisch auf das neue Format umgestellt.

### Zuverlässigerer Sync
- Beim Hochladen wird die Datei erst vollständig übertragen und dann atomar ersetzt — kein halb-fertiger Upload mehr auf dem Server.
- Wenn du die App auf mehreren Geräten nutzt und jemand zwischenzeitlich etwas geändert hat, erkennt die App das jetzt und verhindert, dass Änderungen still überschrieben werden.
- Hintergrund-Sync mit Nextcloud und Google Drive läuft jetzt sauber nacheinander — das verhindert seltene, aber ärgerliche Datenbankfehler.

### Automatische tägliche Backups
Die App legt beim Sync täglich eine Sicherungskopie an. Unter **Einstellungen → Sync & Backup → Ältere Versionen** kannst du frühere Stände wiederherstellen. Wie lange die Kopien aufbewahrt werden, kannst du selbst einstellen (3 bis 30 Tage).

### Vor dem Wiederherstellen wird geprüft
Bevor ein Backup die aktuelle Datenbank ersetzt, prüft die App jetzt, ob die heruntergeladene Datei wirklich integer ist. Falls etwas schiefläuft, rollt die App automatisch zurück — deine Daten sind in diesem Fall unberührt.

### Screenshots gesperrt
Die App verhindert jetzt, dass Eintragsinhalt versehentlich in Screenshots, Bildschirmaufnahmen oder der App-Vorschau im Wechsler auftaucht.

### "Angemeldet bleiben" im Web-Client
Wer das Web-Tagebuch nutzt: Es gibt jetzt eine Option, ob die Zugangsdaten nach dem Schließen des Tabs gespeichert bleiben sollen oder nicht.

---

Wie immer: Deine Daten bleiben auf deinem Gerät. Kein Konto, kein Cloud-Zwang.
