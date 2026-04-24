# CLAUDE.md – Tagebuch-App

## Was wir bauen
Mobile-first Android-App zum schnellen Erfassen persönlicher Log-Einträge. Keine Public Cloud, keine Drittdienste. Alles läuft lokal oder auf dem eigenen NAS (Nextcloud).

## Stack
- Expo (React Native) mit TypeScript
- Expo Router für Navigation
- expo-sqlite für lokale Datenbank
- expo-secure-store für Zugangsdaten
- WebDAV-Sync auf Nextcloud (manuell auslösbar)
- EAS Build für APK

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
  updated_at INTEGER NOT NULL
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

INSERT INTO categories (name) VALUES
  ('Tagebuch'), ('Gesundheit'), ('Ernährung'), ('Sport'), ('Befinden');
```

## Projektstruktur

```
/app
  index.tsx           -- Eintragsliste (Startscreen)
  new.tsx             -- Neuer Eintrag
  entry/[id].tsx      -- Eintrag bearbeiten
  settings.tsx        -- Einstellungen
/components
  EntryCard.tsx
  TagInput.tsx
  CategoryPicker.tsx
  TimestampPicker.tsx
/db
  schema.ts           -- SQL-Definitionen + Migrationen
  entries.ts          -- CRUD Entries
  tags.ts             -- CRUD Tags (upsert bei Neueingabe)
  categories.ts       -- CRUD Categories
/sync
  webdav.ts           -- Nextcloud WebDAV Sync
/hooks
  useEntries.ts
  useTags.ts
```

## Coding-Regeln
- Kein Raw-SQL in Komponenten – immer über `/db`-Funktionen
- Tags per upsert anlegen (entstehen automatisch beim ersten Gebrauch)
- `timestamp` ist User-Zeit (editierbar), `created_at` ist Systemzeit (immutable, nie überschreiben)
- Nextcloud-Passwort in `expo-secure-store`, nie in AsyncStorage
- Kein State-Management-Framework – useState + Context reicht
- Dark Mode bevorzugt
- Eine Hand bedienbar, große Tipp-Targets

## Screens

### index.tsx – Eintragsliste
- Chronologisch, neueste oben
- Kompakte Karten: Timestamp, Text-Preview, Kategorie-Badges, Tags
- Filterbar nach Kategorie und/oder Tag
- Volltextsuche
- FAB (Floating Action Button) → new.tsx

### new.tsx – Neuer Eintrag
- Timestamp: auto = jetzt, per Tap editierbar
- Freitext (mehrzeilig, Autofokus beim Öffnen)
- Kategorien: Mehrfachwahl (Chips)
- Tags: Freitexteingabe mit Autocomplete aus bestehenden Tags
- Speichern-Button prominent

### entry/[id].tsx – Bearbeiten
- Gleiche UI wie new.tsx, vorausgefüllt
- Löschen mit Bestätigung

### settings.tsx – Einstellungen
- Kategorien verwalten (hinzufügen, umbenennen)
- Nextcloud: URL, Benutzername, Passwort
- Sync-Button + letzter Sync-Zeitstempel
- Placeholder: Verschlüsselung (nicht aktiv in v1)

## Sync
- Manuell über Button in Settings
- Überträgt die SQLite-Datei per WebDAV in ein konfigurierbares Verzeichnis auf Nextcloud
- Keine automatische Hintergrundsynchronisation in v1
- Fehler klar anzeigen (falsche URL, falsches Passwort etc.)

## Nicht in v1
- Verschlüsselung (Architektur muss es später ermöglichen)
- Automatischer Hintergrundsync
- Auswertungen oder Diagramme
- iOS
- Bilder oder Anhänge
- Biometrie / Passwortschutz

## Entwicklungsreihenfolge
1. Expo-Projekt initialisieren (Expo Router, TypeScript)
2. SQLite-Schema anlegen inkl. Seed-Kategorien
3. CRUD-Funktionen in `/db`
4. Screen: Eintragsliste
5. Screen: Neuer Eintrag
6. Screen: Eintrag bearbeiten
7. Suche + Filter
8. Screen: Settings + Kategorienverwaltung
9. WebDAV-Sync
10. APK-Build via EAS
