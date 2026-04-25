# CLAUDE.md – Tagebuch-App

## Was wir bauen
Mobile-first Android-App zum schnellen Erfassen persönlicher Log-Einträge. Keine Public Cloud, keine Drittdienste. Alles läuft lokal oder auf dem eigenen NAS (Nextcloud).

## Stack
- Expo SDK 55 (React Native 0.83) mit TypeScript
- Expo Router für Navigation
- expo-sqlite für lokale Datenbank
- expo-secure-store für Zugangsdaten und Schlüssel
- expo-local-authentication für Biometrie-Lock
- expo-crypto für SHA-256 und Zufallsbytes
- expo-location für GPS + Reverse Geocoding
- crypto-js (AES) für DB-Verschlüsselung vor Upload
- WebDAV-Sync auf Nextcloud (manuell + automatisch konfigurierbar)
- EAS Build für Cloud-APK; lokal via Android Studio + `eas build --local`

## Kernprinzip der App
Ein Eintrag = Zeitstempel + Freitext + Kategorien + Tags. Keine Formulare, keine Pflichtfelder außer Text. Schnelle Eingabe ist das wichtigste UX-Ziel: App öffnen → tippen → speichern in unter 5 Sekunden.

## Datenmodell

```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,      -- Unix-Zeit, vom User editierbar
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,     -- gesetzt beim Anlegen, nie ändern
  updated_at INTEGER NOT NULL,
  mood INTEGER,                    -- 1–5, nullable
  health INTEGER,                  -- 1–5, nullable
  latitude REAL,
  longitude REAL,
  location_name TEXT
);

CREATE TABLE entry_categories (
  entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id),
  PRIMARY KEY (entry_id, category_id)
);

CREATE TABLE entry_tags (
  entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id),
  PRIMARY KEY (entry_id, tag_id)
);
```

Neue Spalten werden per Migration (try/catch) in `db/schema.ts` ergänzt — idempotent, sicher bei Updates.

## Projektstruktur

```
/app
  index.tsx             -- Eintragsliste (Startscreen)
  new.tsx               -- Neuer Eintrag
  entry/[id].tsx        -- Eintrag bearbeiten
  settings.tsx          -- Einstellungen
  stats.tsx             -- Statistiken
/components
  EntryCard.tsx
  TagInput.tsx
  DropdownPicker.tsx    -- Material Exposed Dropdown (single + multi)
  QualifierPicker.tsx   -- Emoji-Reihe für Laune/Befinden
  TimestampPicker.tsx
  qualifiers.ts         -- MOOD_EMOJIS, HEALTH_EMOJIS, emojiForLevel()
  theme.ts              -- useColors(), Dark/Light Palette
/contexts
  BiometricContext.tsx  -- Lock-Screen als Overlay (App-State bleibt erhalten)
  ThemeContext.tsx
/db
  schema.ts             -- SQL-Definitionen + Migrationen + closeDb()
  entries.ts            -- CRUD Entries (inkl. mood/health/geo)
  tags.ts               -- CRUD Tags (upsert bei Neueingabe)
  categories.ts         -- CRUD Categories
  stats.ts              -- Aggregierte Statistiken
/sync
  webdav.ts             -- Nextcloud WebDAV Sync + Restore
  backgroundSync.ts     -- Konfigurierbares Auto-Sync-Intervall
/utils
  auth.ts               -- SHA-256 Passwort-Hashing (SecureStore)
  crypto.ts             -- AES-Verschlüsselung der DB-Datei
  location.ts           -- GPS + Reverse Geocoding → Stadtname
  export.ts             -- JSON- und CSV-Export
/hooks
  useEntries.ts
  useTags.ts
```

## Coding-Regeln
- Kein Raw-SQL in Komponenten – immer über `/db`-Funktionen
- Tags per upsert anlegen (entstehen automatisch beim ersten Gebrauch)
- `timestamp` ist User-Zeit (editierbar), `created_at` ist Systemzeit (immutable, nie überschreiben)
- Alle Secrets (Nextcloud-Passwort, Enc-Key, Lock-Passwort-Hash) in `expo-secure-store`, nie in AsyncStorage
- Kein State-Management-Framework – useState + Context reicht
- Dark Mode bevorzugt, Navy/Gold Farbschema (`bg:#0F1B2D`, `accent:#C9A84C`)
- Eine Hand bedienbar, Mindest-Touch-Target 48px (Material Design)
- Speichern-Button immer im Stack-Header (sichtbar über Tastatur)
- Lock-Screen als absolutes Overlay rendern – nie die children unmounten

## Screens

### index.tsx – Eintragsliste
- Chronologisch, neueste oben
- Kompakte Karten: Timestamp, Text-Preview, Laune/Befinden-Emojis, Kategorie-Badges, Tags, Standort
- Segmented Control für Zeitfilter (Heute / Woche / Monat / Alles)
- Multi-Select Dropdowns für Kategorie- und Tag-Filter
- Volltextsuche
- FAB → new.tsx

### new.tsx / entry/[id].tsx – Eintrag erstellen/bearbeiten
- Timestamp: auto = jetzt, per Tap editierbar
- Freitext (mehrzeilig, Autofokus beim Öffnen)
- QualifierPicker: Laune (😞→😄) und Befinden (🤒→💪), je 5 Emoji-Stufen
- Standort-Pill: tippt GPS, zeigt Stadtname, Tap zum Entfernen
- Kategorien: Multi-Select Dropdown
- Tags: Freitexteingabe mit Autocomplete
- Löschen mit Bestätigung (nur edit)

### settings.tsx – Einstellungen
- Kategorien und Tags verwalten (hinzufügen, umbenennen, löschen)
- Nextcloud: URL, Benutzername, Passwort, Pfad
- Sync-Button + Restore-Button + letzter Sync-Zeitstempel
- Auto-Sync: Aus / 15 Min / 1 Std / 6 Std / 24 Std
- Darstellung: Dark/Light Toggle
- Biometrie-Lock: aktivieren/deaktivieren, Passwort ändern, **Passwort-Reset per Biometrie**
- Verschlüsselung: AES vor Upload, Schlüssel zurücksetzen
- Export: JSON / CSV
- Über die App

### stats.tsx – Statistiken
- Anzahl Einträge gesamt / diesen Monat
- Ø Laune und Ø Befinden (nur wenn Daten vorhanden)

## Sicherheit & Lock

### Biometrie-Lock (BiometricContext)
- Sperrt beim App-Start (wenn aktiviert) und nach 15 Sekunden im Hintergrund
- **15s Grace Period**: System-Dialoge (Standort-Permission etc.) triggern keinen Lock
- Lock-Screen als `absoluteFillObject`-Overlay – App-State (offene Formulare) bleibt erhalten
- Zwei Modi: Biometrie (`authenticateAsync`) und Passwort-Fallback (TextInput)
- Passwort-Reset ohne altes Passwort: erst Biometrie-Bestätigung, dann neues Passwort setzen

### Passwort (utils/auth.ts)
- SHA-256 via `expo-crypto.digestStringAsync`
- Gespeichert als Hash in SecureStore (`lock_password_hash`)

### Verschlüsselung (utils/crypto.ts)
- AES (crypto-js) verschlüsselt die SQLite-Datei vor dem Upload
- Schlüssel: 32 zufällige Bytes als Hex-String in SecureStore (`enc_key`)
- Pfade müssen `file://`-Prefix haben (expo-file-system/legacy Anforderung)
- Entschlüsselung beim Restore: `decryptToPath()` → DB ersetzen → `initDb()`

## Sync (sync/webdav.ts)
- Upload: DB-Datei (ggf. verschlüsselt als `.db.enc`) per WebDAV PUT
- Restore: Download → DB schließen (`closeDb()`) → ersetzen → WAL/SHM löschen → `initDb()`
- Auto-Sync via `backgroundSync.ts` mit konfigurierbarem Intervall
- Fehler werden als Alert angezeigt

## Build-Umgebung

### Cloud (EAS)
```bash
eas build --platform android --profile preview --non-interactive
```

### Lokal
```bash
source ~/.bashrc   # lädt JAVA_HOME, ANDROID_HOME
eas build --local --platform android --profile preview
# oder direkt auf angeschlossenes Gerät:
npx expo prebuild  # einmalig → generiert android/
npx expo run:android
```

Installiertes Tooling:
- Android Studio 2024.3.2 → `/opt/android-studio`
- Java (JBR 21) → `/opt/android-studio/jbr`
- Android SDK → `/opt/android-sdk`
- build-tools 35.0.0, platform-tools 37.0, platforms;android-35
- `studio` Symlink → `/usr/local/bin/studio`

## Noch offen / Nächste Schritte
- Recovery Code für "weder Biometrie noch Passwort" Szenario
- iOS-Support (nicht geplant)
- Bilder/Anhänge (nicht geplant)
- Auswertungen/Diagramme (optional)
