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
  settings.tsx          -- Einstellungen (Accordion-Sektionen)
  stats.tsx             -- Statistiken (mit Zeitfilter + Charts)
  calendar.tsx          -- Monatskalender mit Tages-Einträgen
/components
  EntryCard.tsx
  TagInput.tsx
  DropdownPicker.tsx    -- Material Exposed Dropdown (single + multi)
  QualifierPicker.tsx   -- Emoji-Reihe für Laune/Befinden
  TimestampPicker.tsx
  HelpModal.tsx         -- Schritt-für-Schritt-Tour (nummeriete Hilfe-Screens)
  qualifiers.ts         -- MOOD_EMOJIS, HEALTH_EMOJIS, emojiForLevel()
  theme.ts              -- useColors(), Dark/Light Palette
/contexts
  BiometricContext.tsx  -- Lock-Screen als Overlay (App-State bleibt erhalten)
  ThemeContext.tsx
  LanguageContext.tsx   -- Aktive Sprache (de/en), gespeichert in AsyncStorage
/i18n
  de.ts                 -- Deutsche UI-Strings (vollständig)
  en.ts                 -- Englische UI-Strings (vollständig)
  index.ts              -- useT() Hook → gibt typisierten String-Record zurück
/db
  schema.ts             -- SQL-Definitionen + Migrationen + closeDb()
  entries.ts            -- CRUD Entries (inkl. mood/health/geo)
  tags.ts               -- CRUD Tags (upsert bei Neueingabe)
  categories.ts         -- CRUD Categories
  stats.ts              -- Aggregierte Statistiken (inkl. getCategoryUsage, getTagUsage)
/sync
  webdav.ts             -- Nextcloud WebDAV Sync + Restore
  backgroundSync.ts     -- Konfigurierbares Auto-Sync-Intervall
  syncLog.ts            -- Persistenter Sync-Log (SecureStore)
/utils
  auth.ts               -- SHA-256 Passwort-Hashing (SecureStore)
  crypto.ts             -- AES-Verschlüsselung der DB-Datei
  location.ts           -- GPS + Reverse Geocoding → Stadtname
  export.ts             -- JSON- und CSV-Export
  notifications.ts      -- expo-notifications: tägliche Erinnerung planen/löschen
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
- Volltextsuche (Suchbegriff in EntryCard hervorheben)
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
Sektionen sind einklappbar (Accordion). Gliederung:
- **Inhalte**: Kategorien und Tags verwalten (hinzufügen, umbenennen, löschen)
- **Sync & Backup**: Nextcloud URL/User/PW/Pfad, Sync-Button, Restore-Button, letzter Sync-Zeitstempel, Auto-Sync-Intervall, Sync-Log (einklappbar)
- **Sicherheit**: Biometrie-Lock (aktivieren/deaktivieren, Passwort ändern, Reset per Biometrie), Verschlüsselung (AES vor Upload, Schlüssel zurücksetzen)
- **Erinnerungen**: Tägliche Benachrichtigung aktivieren, Uhrzeit wählen
- **Darstellung**: Farbmodus Hell / Dunkel / System (folgt Systemeinstellung), Sprache DE/EN
- **Export**: JSON / CSV
- **Über die App**: App-Icon, Name, Version, Build-Info (Android Studio), Lizenz

### stats.tsx – Statistiken
- Globaler Zeitfilter (Tag / Woche / Monat / Jahr / Frei)
- Eintragsanzahl gesamt / im Zeitraum
- Laune- und Befinden-Trend als Doppelliniendiagramm
- Heatmap der Eintragsfrequenz (adaptive Granularität)
- Balkendiagramm Einträge pro Periode
- Kategorien-Rang: Balkendiagramm der meistgenutzten Kategorien im Zeitraum
- Tag-Rang: Balkendiagramm der meistgenutzten Tags im Zeitraum

### calendar.tsx – Kalenderansicht
- Monatskalender, Tage mit Einträgen markiert
- Tap auf Tag → Einträge des Tages als Liste darunter

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

## Versionierung

Semver: `major.minor.patch` in `package.json` und `app.json`. `versionCode` wird bei jedem Bump um 1 erhöht.

```bash
npm run bump           # patch  (z. B. 2.1.0 → 2.1.1)
npm run bump:minor     # minor  (z. B. 2.1.0 → 2.2.0)
npm run bump:major     # major  (z. B. 2.1.0 → 3.0.0)
```

Das Skript (`scripts/bump.js`) aktualisiert `package.json` + `app.json`, erstellt einen Git-Commit und setzt einen Tag (`v2.1.0`).

**Vor jedem Build immer zuerst bump aufrufen.**

## Build-Umgebung

### Cloud (EAS)
```bash
npm run bump           # Version hochzählen
eas build --platform android --profile preview --non-interactive --message "v$(node -p "require('./package.json').version")"
# Kurzform:
npm run build          # bump:patch + EAS-Build in einem Schritt
npm run build:minor    # bump:minor + EAS-Build
```

### Lokal (Android Studio)
```bash
source ~/.bashrc       # lädt JAVA_HOME, ANDROID_HOME
npm run bump           # Version hochzählen + committen
npx expo prebuild --platform android --clean   # generiert android/ (einmalig oder nach Abhängigkeitsänderungen)
bash scripts/prepare-android.sh                # patcht Gradle-Settings (Heap, Daemon, Gradle 8.13)
cd android && ./gradlew assembleRelease         # baut APK
# APK liegt in: android/app/build/outputs/apk/release/app-release.apk
```

Hinweis: `android/` ist gitigniert (von prebuild generiert). Nach jedem `prebuild --clean` muss
`scripts/prepare-android.sh` ausgeführt werden, um die lokalen Build-Settings zu patchen.

Installiertes Tooling:
- Android Studio 2024.3.2 → `/opt/android-studio`
- Java (JBR 21) → `/opt/android-studio/jbr`  (`JAVA_HOME` in `~/.bashrc`)
- Android SDK → `/opt/android-sdk`  (`ANDROID_HOME` in `~/.bashrc`)
- build-tools 35.0.0, platform-tools 37.0, platforms;android-35
- `studio` Symlink → `/usr/local/bin/studio`

## Mehrsprachigkeit (i18n)
- Kein externes i18n-Framework — eigener schlanker `useT()` Hook via `LanguageContext`
- `i18n/de.ts` und `i18n/en.ts` exportieren je ein `const strings = { ... }` Objekt mit identischer Struktur
- `i18n/index.ts` exportiert `useT()` → gibt den passenden String-Record zurück
- Sprache in `SecureStore` unter `app_language` speichern, Default: Systemsprache (`expo-localization`)
- Beim Hinzufügen neuer UI-Strings immer **beide** Dateien gleichzeitig ergänzen
- Keine automatische Übersetzung: alle Strings manuell formulieren

## Benachrichtigungen (utils/notifications.ts)
- `expo-notifications` für lokale tägliche Erinnerungen
- Uhrzeit und Aktivierung in `AsyncStorage` persistieren (`reminder_enabled`, `reminder_time`)
- Nur planen wenn Berechtigung vorhanden; ohne Berechtigung graceful degradieren
- Beim App-Start prüfen ob Notification noch geplant, ggf. neu registrieren

## Hilfe-Tour (components/HelpModal.tsx)
- Modales Overlay mit nummerierten Schritten (Weiter / Zurück / Schließen)
- Je ein Schritt pro Haupt-Feature: Eintrag erstellen, Suche & Filter, Kalender, Statistiken, Sync, Sicherheit
- Erreichbar über `?`-Button im Header der index.tsx und über Settings > Über die App
- Beim ersten App-Start automatisch anzeigen (Flag `help_shown` in AsyncStorage)
- Texte kommen aus i18n — kein Hardcoding

## Android Widget (geplant)
- Schnelleingabe-Widget für den Android-Homescreen
- Umsetzung via nativer Glance-Komponente im `android/`-Ordner nach `expo prebuild`
- Widget öffnet `new.tsx` direkt mit einem Deep-Link (`tagebuch://new`)
- Nur Android; iOS nicht geplant

## Noch offen / Nächste Schritte

### Sofort (kleine Fixes)
- [x] Recovery Code für "weder Biometrie noch Passwort" Szenario
- [x] "Über die App" korrigieren: Framework React Native, Build via Android Studio; Entwickelt von Olaf
- [x] App-Logo (assets/icon.png) im "Über die App"-Block anzeigen

### Einstellungen refactoring
- [x] Einstellungen in einklappbare Accordion-Sektionen gliedern (Inhalte / Sync & Backup / Sicherheit / Darstellung / Export / Über die App)

### Darstellungsmodus
- [x] ThemeContext: Dritter Modus `'system'` ergänzen — folgt `Appearance.getColorScheme()` + `Appearance.addChangeListener`
- [x] Settings: Toggle "Hell / Dunkel / System" (3-Way statt boolean Switch)
- [x] Default für Neuinstallationen: `'system'`
- [x] Suchbegriff im EntryCard-Text hervorheben (HighlightedText, Text-Splitting)

### Erinnerungen
- [x] `utils/notifications.ts` implementieren (planen, löschen, Berechtigung)
- [x] Berechtigung beim ersten Aktivieren anfragen
- [x] Sektion "Erinnerungen" in settings.tsx: Toggle + Uhrzeit-Picker (±1h/±5min)
- [x] Beim App-Start: geplante Notification prüfen und ggf. neu registrieren

### Statistiken erweitern
- [x] `db/stats.ts`: perCategory/perTag LIMIT auf 10 erhöht
- [x] stats.tsx: Kategorien-Balkendiagramm (Top 10, labelWidth=110)
- [x] stats.tsx: Tag-Balkendiagramm (Top 10, labelWidth=110)

### Mehrsprachigkeit (DE + EN)
- [x] `i18n/de.ts`, `i18n/en.ts`, `i18n/index.ts` anlegen
- [x] `LanguageContext.tsx` anlegen (Sprache laden/speichern, Default via expo-localization)
- [x] Alle UI-Strings in allen Screens und Komponenten auf `useT()` umstellen
- [x] Sprach-Auswahl in Settings > Darstellung ergänzen
- [x] Lock-Screen: Tastatur überlagert Eingabefelder nicht mehr (KeyboardAvoidingView + ScrollView + SafeAreaInsets)

### Hilfe-Tour
- [x] `HelpModal.tsx` mit Schritt-Logik implementieren (6 Schritte, Punkte-Navigation, Weiter/Zurück/Fertig)
- [x] Tour-Inhalte in i18n-Strings formulieren (DE + EN)
- [x] `?`-Button in index.tsx-Header verdrahten
- [x] Beim ersten Start automatisch anzeigen (SecureStore-Flag `help_shown`)

### Android Widget
- [x] gestrichen — zu eng gekoppelt an generierten android/-Ordner, kein stabiler Mehrwert

### [x] Sync: Bidirektionaler Merge (Multi-Client)

**Problem:** `syncNow()` macht bisher nur einen PUT-Upload. Zwei Clients überschreiben sich gegenseitig — jeder sieht nur seine eigenen Daten.

**Ursache:** Kein Download-before-Upload, kein Merge. IDs sind pro Client unabhängig (AUTOINCREMENT), können nicht als stabiler Identifier dienen. Stabiler Identifier: `created_at` (einmalig beim Anlegen, nie geändert).

**Lösung: SQLite ATTACH DATABASE-Merge in `sync/webdav.ts`**

`syncNow()` soll folgendes tun:
1. Remote-DB herunterladen (falls vorhanden) → Temp-Datei (analog zu `restoreNow`)
2. `ATTACH 'tempPath' AS remote` auf der lokalen DB-Verbindung via `db.execAsync`
3. Merge-SQL ausführen (in dieser Reihenfolge):
   - Kategorien: `INSERT OR IGNORE INTO categories (name) SELECT name FROM remote.categories`
   - Tags: `INSERT OR IGNORE INTO tags (name) SELECT name FROM remote.tags`
   - Einträge INSERT (neue aus Remote, `created_at` fehlt lokal):
     ```sql
     INSERT INTO entries (timestamp, text, created_at, updated_at, mood, health, latitude, longitude, location_name)
     SELECT re.timestamp, re.text, re.created_at, re.updated_at, re.mood, re.health, re.latitude, re.longitude, re.location_name
     FROM remote.entries re
     WHERE re.created_at NOT IN (SELECT created_at FROM entries)
     ```
   - Einträge UPDATE (Konflikt, Remote ist neuer):
     ```sql
     UPDATE entries SET timestamp=(SELECT re.timestamp FROM remote.entries re WHERE re.created_at=entries.created_at),
       text=(SELECT re.text FROM remote.entries re WHERE re.created_at=entries.created_at),
       updated_at=(SELECT re.updated_at FROM remote.entries re WHERE re.created_at=entries.created_at),
       mood=(SELECT re.mood FROM remote.entries re WHERE re.created_at=entries.created_at),
       health=(SELECT re.health FROM remote.entries re WHERE re.created_at=entries.created_at),
       latitude=(SELECT re.latitude FROM remote.entries re WHERE re.created_at=entries.created_at),
       longitude=(SELECT re.longitude FROM remote.entries re WHERE re.created_at=entries.created_at),
       location_name=(SELECT re.location_name FROM remote.entries re WHERE re.created_at=entries.created_at)
     WHERE created_at IN (SELECT re.created_at FROM remote.entries re
       WHERE re.updated_at > (SELECT le.updated_at FROM entries le WHERE le.created_at=re.created_at))
     ```
   - Junction-Tabellen (Mapping via `created_at` für Einträge, `name` für Kategorien/Tags):
     ```sql
     INSERT OR IGNORE INTO entry_categories (entry_id, category_id)
     SELECT le.id, lc.id
     FROM remote.entry_categories rec
     JOIN remote.entries re ON re.id = rec.entry_id
     JOIN remote.categories rc ON rc.id = rec.category_id
     JOIN entries le ON le.created_at = re.created_at
     JOIN categories lc ON lc.name = rc.name
     ```
     (analog für `entry_tags`)
4. `DETACH remote`, Temp-Datei löschen
5. Gemergete lokale DB hochladen (wie bisher)
6. Falls Remote-DB nicht vorhanden (404): nur hochladen, kein Merge nötig (Erstsync)
7. Log-Eintrag mit Anzahl neu importierter Einträge

Kein Alert bei erfolgreichen Merges — nur im Sync-Log festhalten. Fehler wie bisher als Alert.

### [x] Auto-Sync: Foreground-Trigger als Hauptmechanismus

**Problem:** `expo-background-fetch` ist auf Android strukturell unzuverlässig (Doze, App Standby, Hersteller-Optimierungen). Der OS entscheidet, wann oder ob der Task läuft.

**Lösung: AppState-Listener in `app/_layout.tsx`**

- `AppState.addEventListener('change', handler)` lauscht auf `'active'` (App kommt in Vordergrund)
- Im Handler: `lastSync`-Timestamp aus SecureStore lesen, Intervall aus `getAutoSyncInterval()`
- Wenn `Date.now() - lastSyncMs > intervalMs` → `syncNow()` silent im Hintergrund (kein Alert bei Erfolg, nur Log)
- `BackgroundFetch`-Registrierung in `backgroundSync.ts` bleibt als best-effort-Ergänzung
- Beim App-Start (Mount des Root-Layouts): prüfen ob Background-Task noch registriert, ggf. neu registrieren (`isTaskRegisteredAsync` → `registerTaskAsync`)

### Nicht geplant
- iOS-Support
- Bilder/Anhänge
- Gamification (Streaks etc.)
