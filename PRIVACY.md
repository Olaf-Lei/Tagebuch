# Datenschutzerklärung – Tagebuch

**Stand: Mai 2026**

---

## Deutsch

### 1. Verantwortlicher

Olaf L
E-Mail: tagebuch.promenade340@slmail.me

### 2. Welche Daten werden verarbeitet?

Die App verarbeitet ausschließlich Daten, die du selbst eingibst:

- **Tagebucheinträge** – Freitext, Datum und Uhrzeit
- **Kategorien und Tags** – selbst vergebene Bezeichnungen
- **Bewertungen (Qualifiers)** – optionale 1–5-Skalen (z. B. Stimmung, Schlaf)
- **Standortdaten** – GPS-Koordinaten und Ortsname, nur wenn du den Standort-Button tippst (optional)

### 3. Wo werden die Daten gespeichert?

Alle Daten werden **ausschließlich lokal auf deinem Gerät** in einer SQLite-Datenbank gespeichert. Es gibt keinen zentralen Server und keine Cloud-Anbindung durch den Entwickler.

### 4. Optionaler Sync

Du kannst die Datenbank freiwillig mit einem externen Speicher synchronisieren:

- **Nextcloud / WebDAV** – dein eigener Server. Daten verlassen dein Gerät nur in Richtung des von dir selbst konfigurierten Servers.
- **Google Drive** – Googles Cloud-Dienst. Wenn du Google Drive aktivierst, wird eine verschlüsselte Kopie der Datenbank in deinem Google-Drive-Konto gespeichert. Es gelten dann zusätzlich die [Datenschutzbestimmungen von Google](https://policies.google.com/privacy).

Beide Optionen sind deaktiviert, solange du sie nicht selbst einrichtest.

### 5. Standort und Geocoding

Wenn du den Standort-Button verwendest, wird einmalig deine GPS-Position ermittelt. Zur Anzeige eines lesbaren Ortsnamens (z. B. „Berlin") nutzt die App den Geocoding-Dienst des Betriebssystems. Auf Android-Geräten wird dieser Dienst von Google bereitgestellt; dabei werden deine Koordinaten kurzzeitig an Google übermittelt. Weitere Informationen: [Google Privacy Policy](https://policies.google.com/privacy).

Die Standorterfassung erfolgt nur auf explizite Nutzeraktion hin. Die App fragt keine kontinuierliche Standorterfassung im Hintergrund an.

### 6. Biometrie / App-Sperre

Die optionale Biometrie-Sperre (Fingerabdruck, Gesichtserkennung) läuft vollständig auf dem Gerät über die Android-Systemfunktion. Biometrische Merkmale verlassen das Gerät nicht und werden vom Entwickler weder erhoben noch gespeichert.

### 7. Verschlüsselung

Bei aktiviertem Sync wird die Datenbank vor der Übertragung mit AES verschlüsselt. Der Schlüssel wird ausschließlich lokal im sicheren Gerätespeicher (Android Keystore) abgelegt.

### 8. Weitergabe an Dritte

Es werden **keine Daten an Dritte weitergegeben**, verkauft oder für Werbezwecke genutzt. Es existiert keine Analyse, kein Tracking, keine Werbung.

### 9. Deine Rechte

Da alle Daten lokal auf deinem Gerät liegen, hast du jederzeit vollständige Kontrolle: Einträge löschen, die App deinstallieren oder die Datenbank exportieren (JSON/CSV über Einstellungen → Export).

### 10. Kontakt

Bei Fragen zur Datenschutzerklärung: tagebuch.promenade340@slmail.me

---

## English

**Last updated: May 2026**

### 1. Controller

Olaf L
Email: tagebuch.promenade340@slmail.me

### 2. What data is processed?

The app processes only data you enter yourself:

- **Journal entries** – free text, date and time
- **Categories and tags** – labels you define yourself
- **Qualifiers** – optional 1–5 ratings (e.g. mood, sleep)
- **Location data** – GPS coordinates and place name, only when you tap the location button (optional)

### 3. Where is data stored?

All data is stored **exclusively on your device** in a local SQLite database. There is no central server and no cloud connection operated by the developer.

### 4. Optional sync

You may voluntarily sync the database with external storage:

- **Nextcloud / WebDAV** – your own server. Data only leaves your device to the server you configured yourself.
- **Google Drive** – Google's cloud service. If you enable Google Drive, an encrypted copy of the database is stored in your Google Drive account. Google's [Privacy Policy](https://policies.google.com/privacy) applies additionally.

Both options are disabled until you set them up.

### 5. Location and geocoding

When you tap the location button, your GPS position is retrieved once. To display a readable place name (e.g. "Berlin"), the app uses the operating system's geocoding service. On Android devices, this service is provided by Google; your coordinates are briefly transmitted to Google for this purpose. See [Google Privacy Policy](https://policies.google.com/privacy) for details.

Location is only captured on explicit user action. The app does not request continuous background location.

### 6. Biometrics / app lock

The optional biometric lock (fingerprint, face recognition) runs entirely on the device via Android's system API. Biometric data never leaves the device and is neither collected nor stored by the developer.

### 7. Encryption

When sync is enabled, the database is AES-encrypted before transfer. The encryption key is stored exclusively in the device's secure storage (Android Keystore).

### 8. Data sharing

**No data is shared with third parties**, sold, or used for advertising. There is no analytics, no tracking, no advertising.

### 9. Your rights

Since all data resides locally on your device, you have full control at all times: delete entries, uninstall the app, or export your database (JSON/CSV via Settings → Export).

### 10. Contact

For questions about this privacy policy: tagebuch.promenade340@slmail.me
