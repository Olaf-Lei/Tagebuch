# Tagebuch

Persönliche Tagebuch-App für Android. Schnelle Erfassung von Log-Einträgen — lokal, privat, ohne Cloud-Zwang.

## Funktionen

- **Schnelle Eingabe** — App öffnen, tippen, speichern in unter 5 Sekunden
- **Kategorien & Tags** — Mehrfach-Kategorisierung und freie Hashtags mit Autocomplete
- **Volltextsuche** mit Datumfilter (heute / Woche / Monat / alles)
- **Kalenderansicht** — Monatsraster, Punkte auf Tagen mit Einträgen
- **Statistiken** — KPI-Kacheln, 26-Wochen-Heatmap, Balkendiagramme, Streak-Zähler
- **Hell/Dunkel-Modus** (persistent)
- **Export** als JSON oder CSV
- **Nextcloud-Sync** — WebDAV, manuell oder automatisch im Hintergrund
- Vollständig **offline-fähig**, alle Daten lokal in SQLite

## Stack

| Komponente | Version |
|---|---|
| Expo SDK | 55 |
| React Native | 0.83.6 |
| React | 19.2.0 |
| Expo Router | 55.x |
| expo-sqlite | 55.x |
| expo-secure-store | 55.x |
| expo-background-fetch | 55.x |

## Projektstruktur

```
/app
  index.tsx           Eintragsliste (Startscreen)
  new.tsx             Neuer Eintrag
  entry/[id].tsx      Eintrag bearbeiten
  settings.tsx        Einstellungen
  calendar.tsx        Kalenderansicht
  stats.tsx           Statistik-Screen

/components
  EntryCard.tsx       Karte in der Liste
  TagInput.tsx        Freitexteingabe mit Autocomplete
  CategoryPicker.tsx  Chip-Auswahl
  TimestampPicker.tsx Nativer Datum/Zeit-Dialog
  theme.ts            Farbpaletten + useColors()-Hook

/contexts
  ThemeContext.tsx    Hell/Dunkel-Modus (SecureStore-persistent)

/db
  schema.ts           SQL-Schema + Migrationen
  entries.ts          CRUD Einträge
  tags.ts             CRUD Tags (upsert)
  categories.ts       CRUD Kategorien
  stats.ts            Statistik-Abfragen + Streak-Berechnung

/sync
  webdav.ts           Nextcloud WebDAV Upload/Download
  backgroundSync.ts   Hintergrund-Task (TaskManager + BackgroundFetch)

/hooks
  useEntries.ts
  useTags.ts

/utils
  export.ts           JSON- und CSV-Export via expo-sharing
```

## Build

APK via EAS Build (Expo Application Services):

```bash
npm install
eas build --platform android --profile preview
```

Voraussetzung: `eas-cli` installiert, bei `expo.dev` eingeloggt.

Die `.npmrc` setzt `legacy-peer-deps=true` — notwendig wegen react-dom-Peer-Konflikt unter SDK 55.

## Datenmodell

```sql
entries        id, timestamp (user-editierbar), text, created_at, updated_at
categories     id, name UNIQUE
tags           id, name UNIQUE
entry_categories  entry_id, category_id
entry_tags        entry_id, tag_id
```

`timestamp` = Zeitpunkt laut Nutzer (editierbar).
`created_at` = Systemzeit beim Anlegen (immutable).

## Sync

Nextcloud WebDAV: Die SQLite-Datenbankdatei wird in das konfigurierte Verzeichnis hochgeladen. Der vollständige WebDAV-Pfad (`/remote.php/dav/files/USERNAME/...`) wird automatisch konstruiert — es reicht die Basis-URL der Nextcloud-Instanz.

Hintergrundsync: konfigurierbar in 15 Min / 1 Std / 6 Std / 24 Std oder deaktiviert.

## Lizenz

Privates Projekt.
