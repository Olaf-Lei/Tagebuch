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
  name TEXT NOT NULL UNIQUE,
  color TEXT                        -- Hex-Farbe für Badge-Anzeige
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,       -- Unix-Zeit, vom User editierbar
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,      -- gesetzt beim Anlegen, nie ändern
  updated_at INTEGER NOT NULL,
  latitude REAL,
  longitude REAL,
  location_name TEXT
  -- mood/health-Spalten existieren noch für Migration, werden aber nicht mehr genutzt
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

-- Custom Qualifiers: user-definierte 1–5-Bewertungen
CREATE TABLE qualifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  emoji_preset TEXT NOT NULL DEFAULT 'mood',  -- Schlüssel in EMOJI_PRESETS
  position INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0          -- Soft-Delete
);

CREATE TABLE entry_qualifiers (
  entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
  qualifier_id INTEGER REFERENCES qualifiers(id) ON DELETE CASCADE,
  value INTEGER NOT NULL,                     -- 1–5
  PRIMARY KEY (entry_id, qualifier_id)
);

-- Kategorie → Qualifier-Bindung: gebundene Qualifiers erscheinen oben im Formular
CREATE TABLE category_qualifiers (
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  qualifier_id INTEGER REFERENCES qualifiers(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, qualifier_id)
);
```

Neue Spalten/Tabellen per Migration (try/catch) in `db/schema.ts` — idempotent, sicher bei Updates.

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
  QualifierPicker.tsx   -- Emoji-Reihe für dynamische Qualifiers (1–5 Stufen)
  TimestampPicker.tsx
  HelpModal.tsx         -- Schritt-für-Schritt-Tour (nummeriete Hilfe-Screens)
  qualifiers.ts         -- EMOJI_PRESETS (mood/health/sleep/energy/pain/stress), emojiForLevel()
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
  entries.ts            -- CRUD Entries (qualifierValues: Record<number,number>)
  tags.ts               -- CRUD Tags (upsert bei Neueingabe)
  categories.ts         -- CRUD Categories (inkl. color)
  qualifiers.ts         -- CRUD Qualifiers + category_qualifiers + getQualifiersForCategories()
  stats.ts              -- Aggregierte Statistiken + getQualifierTrend()
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
  useQualifiers.ts      -- aktive Qualifiers ohne Kategorie-Kontext (EntryCard, index.tsx)
  useLayout.ts          -- isWide, formMaxWidth, listMaxWidth
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

## Arbeitsweise (Claude-Hinweise)
- Vor jeder Implementierung zuerst `git diff HEAD` lesen — offene Änderungen kennen
- Einen Schritt aus dem Backlog pro Session — kein Scope-Creep
- Specs als Code schreiben (SQL, Dateiname:Zeile, Pseudocode) statt Prosa
- Kein Cleanup, kein Refactoring außerhalb des beauftragten Schritts
- Nach dem Feature: Backlog aktualisieren, `npm run bump`, committen und pushen
- Nach jedem Fix/Feature mitteilen, ob `full` oder `quick` gebaut werden muss, und den genauen Befehl angeben:
  - `--quick` (default): nur JS-Änderungen (`.ts`, `.tsx`, Assets, i18n, Sync-Logik) → `./bauen.sh`
  - `--full`: native Abhängigkeiten geändert (`package.json` Deps, `app.json` plugins/permissions, neue native Module) → `./bauen.sh --full`

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
- QualifierPicker: dynamisch — kategorie-gebundene Qualifiers oben, dann globale
  - Sichtbare Qualifiers = global (kein Kategorie-Link) ∪ Qualifiers der gewählten Kategorien
  - Beim Abwählen einer Kategorie: deren Qualifier-Werte werden gelöscht
- Standort-Pill: tippt GPS, zeigt Stadtname, Tap zum Entfernen
- Kategorien: Multi-Select Dropdown
- Tags: Freitexteingabe mit Autocomplete
- Löschen mit Bestätigung (nur edit)

### settings.tsx – Einstellungen
Sektionen sind einklappbar (Accordion). Gliederung:
- **Inhalte**: Kategorien (Farbe + 📊-Button für Qualifier-Zuweisung), Tags, Bewertungen verwalten
  - Kategorien: Farb-Swatch, 📊-Button öffnet Qualifier-Modal, Umbenennen, Löschen
  - Bewertungen: Liste mit aktiven/inaktiven Qualifiers, Schnell-Hinzufügen-Chips für nicht angelegte Presets
  - Preset-Picker zeigt alle 5 Emojis des Presets inline
- **Sync & Backup**: Nextcloud URL/User/PW/Pfad, Sync-Button, Restore-Button, letzter Sync-Zeitstempel, Auto-Sync-Intervall, Sync-Log (einklappbar)
- **Sicherheit**: Biometrie-Lock (aktivieren/deaktivieren, Passwort ändern, Reset per Biometrie), Verschlüsselung (AES vor Upload, Schlüssel zurücksetzen)
- **Erinnerungen**: Tägliche Benachrichtigung aktivieren, Uhrzeit wählen
- **Darstellung**: Farbmodus Hell / Dunkel / System (folgt Systemeinstellung), Sprache DE/EN
- **Export**: JSON / CSV
- **Über die App**: App-Icon, Name, Version, Build-Info (Android Studio), Lizenz

### stats.tsx – Statistiken
- Globaler Zeitfilter (Tag / Woche / Monat / Jahr / Frei)
- Eintragsanzahl gesamt / im Zeitraum
- Qualifier-Trend: n Kurven (eine pro aktiver Qualifier), Farbpalette, Icon + Name als Legende
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
- Schlüssel-Transfer: `exportEncKey()` → Hex-String anzeigen → auf Gerät 2 via `importEncKey()` eintragen (Settings → Sicherheit)

## Sync (sync/webdav.ts)

### syncNow() — bidirektionaler Merge
1. Remote-DB herunterladen (probt `.db.enc`, dann `.db`; 404 → Erstsync)
2. `ATTACH DATABASE tempPath AS remote`, Merge via SQL:
   - `INSERT OR IGNORE` für categories + tags (nach Name)
   - Neue entries importieren (created_at fehlt lokal)
   - Vorhandene entries updaten wenn `remote.updated_at > local.updated_at`
   - Junction-Tabellen via `created_at`/`name` mappen
3. `DETACH`, Temp-Datei löschen, gemergete DB hochladen
4. Kein Alert bei Erfolg — nur Sync-Log. Fehler werden als Alert angezeigt.
5. `_syncInProgress`-Flag verhindert parallele Läufe

### restoreNow()
Download → probt `.db.enc` zuerst, dann `.db` → `closeDb()` → ersetzen → WAL/SHM löschen → `initDb()`

### Auto-Sync
- Primär: `AppState`-Listener in `_layout.tsx` (Foreground-Trigger, zuverlässig)
- Sekundär: `expo-background-fetch` als best-effort-Ergänzung
- Intervall aus SecureStore (`bg_sync_interval`), 0 = deaktiviert

## Versionierung

Schema `x.y.z` (Semver), `versionCode` steigt bei jedem Bump um 1.

| Ebene | Wer entscheidet | Wann |
|---|---|---|
| `z` patch | Claude automatisch | Jeder Build |
| `y` minor | Olaf gibt vor | Neue Features / größere Änderungen |
| `x` major | Olaf gibt vor | Breaking Changes / komplette Überarbeitungen |

```bash
npm run bump           # patch  (2.1.0 → 2.1.1) — Standard vor jedem Build
npm run bump:minor     # minor  (2.1.0 → 2.2.0) — nur auf Anweisung
npm run bump:major     # major  (2.1.0 → 3.0.0) — nur auf Anweisung
```

Das Skript (`scripts/bump.js`) aktualisiert `package.json` + `app.json`, erstellt einen Git-Commit und setzt einen Tag.

**Pflichten bei jedem Build (patch):**
- `npm run bump` aufrufen
- `CHANGELOG.md` um einen Eintrag ergänzen (Datum, Version, Änderungen als Bullet-Liste)

**Zusätzliche Pflichten bei minor/major:**
- README.md aktualisieren (Features, Stack, Struktur)
- CLAUDE.md auf aktuellen Stand bringen (Screens, Sync, Sicherheit etc.)

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

## Backlog

### Offen (nach Priorität)

*Keine offenen Punkte.*

### Erledigt
- **Web-Client** — `web/` Verzeichnis; React + Vite + sql.js + TypeScript; PHP-Proxy für WebDAV (CORS-Lösung); Deploy via `web/deploy.sh` (rsync nach Manitu); CRUD + Qualifiers + Kategorien + Tags; Navy/Gold-Theme
- **Custom Qualifiers** — `qualifiers` + `entry_qualifiers` Tabellen; Migration mood/health; EMOJI_PRESETS; dynamische QualifierPicker in Formularen; generischer TrendChart in Stats; Verwaltung in Settings › Inhalte
- **Responsives Layout** — `hooks/useLayout.ts`, `isWide >= 700px`; Calendar split-view; Stats zwei Spalten; Formulare + Liste maxWidth zentriert
- **Standort-Karte** — `map.tsx` mit WebView + Leaflet + MarkerCluster; Zeitfilter; Tap → Entry öffnen
- **Kategorien-Farben** — `color TEXT` in `categories`, Palette + freier Hex-Picker in Settings, Badges in EntryCard und DropdownPicker
- **Burger-Menü** — Settings-Icon oben links im Header von `index.tsx`
- **Sync-Löschpropagierung, Auto-Refresh**

### Nicht geplant
- iOS-Support
- Bilder/Anhänge
- Gamification (Streaks etc.)
- Android Widget (zu eng an generierten `android/`-Ordner gekoppelt)
- Web-Client-Erweiterungen (Statistiken, Kalender, Kartenansicht im Browser)
