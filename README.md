# Tagebuch

Persönliche Tagebuch-App für Android. Schnelle Erfassung von Log-Einträgen — lokal, privat, ohne Cloud-Zwang.

## Funktionen

- **Schnelle Eingabe** — App öffnen, tippen, speichern in unter 5 Sekunden
- **Kategorien & Tags** — Mehrfach-Kategorisierung mit individuellen Farben, freie Hashtags mit Autocomplete
- **Laune & Befinden** — je 5 Emoji-Stufen pro Eintrag, optional
- **GPS-Standort** — automatisch als Stadtname, per Tap entfernbar
- **Volltextsuche** — mit Suchbegriff-Hervorhebung und Datumfilter (Heute / Woche / Monat / Alles)
- **Kalenderansicht** — Monatsraster, Tage mit Einträgen markiert
- **Statistiken** — Laune/Befinden-Trend, Heatmap, Balkendiagramme, Top-Kategorien & Tags
- **Biometrie-Lock** — Fingerabdruck + Passwort-Fallback, 15s Grace Period
- **Nextcloud-Sync** — bidirektionaler Merge via WebDAV, manuell oder automatisch
- **AES-Verschlüsselung** — DB wird vor dem Upload verschlüsselt; Schlüssel-Transfer zwischen Geräten möglich
- **Tägliche Erinnerung** — lokale Notification zur konfigurierbaren Uhrzeit
- **Hell / Dunkel / System** — folgt Systemeinstellung oder manuell
- **DE / EN** — vollständig zweisprachig
- **Hilfe-Tour** — 6-schrittiger Onboarding-Guide, beim ersten Start automatisch
- **Export** als JSON oder CSV
- Vollständig **offline-fähig**, alle Daten lokal in SQLite

## Stack

| Komponente | Version |
|---|---|
| Expo SDK | 55 |
| React Native | 0.83 |
| Expo Router | 55.x |
| expo-sqlite | 55.x |
| expo-secure-store | 55.x |
| expo-local-authentication | 55.x |
| expo-notifications | 55.x |
| crypto-js | AES |

## Projektstruktur

```
/app
  index.tsx           Eintragsliste (Startscreen)
  new.tsx             Neuer Eintrag
  entry/[id].tsx      Eintrag bearbeiten
  settings.tsx        Einstellungen (Accordion)
  calendar.tsx        Kalenderansicht
  stats.tsx           Statistik-Screen
  _layout.tsx         Root-Layout, AppState-Listener für Auto-Sync

/components
  EntryCard.tsx       Karte in der Liste (mit Hervorhebung)
  TagInput.tsx        Freitexteingabe mit Autocomplete
  DropdownPicker.tsx  Material Exposed Dropdown (single + multi)
  QualifierPicker.tsx Emoji-Reihe für Laune/Befinden
  TimestampPicker.tsx Datum/Zeit-Dialog
  HelpModal.tsx       Schritt-für-Schritt-Tour

/contexts
  BiometricContext.tsx  Lock-Screen als Overlay
  ThemeContext.tsx      Hell/Dunkel/System
  LanguageContext.tsx   DE/EN

/i18n
  de.ts / en.ts       UI-Strings
  index.ts            useT() Hook

/db
  schema.ts           SQL-Schema + Migrationen
  entries.ts          CRUD Einträge
  tags.ts / categories.ts
  stats.ts            Statistik-Abfragen

/sync
  webdav.ts           Bidirektionaler Sync + Restore
  backgroundSync.ts   BackgroundFetch-Task + Foreground-Trigger
  syncLog.ts          Persistenter Sync-Log

/utils
  auth.ts             SHA-256 Passwort-Hashing
  crypto.ts           AES-Verschlüsselung + Key-Export/Import
  location.ts         GPS + Reverse Geocoding
  export.ts           JSON- und CSV-Export
  notifications.ts    Tägliche Erinnerung
```

## Datenmodell

```sql
entries          id, timestamp (user-editierbar), text, created_at (immutable), updated_at,
                 mood, health, latitude, longitude, location_name
categories       id, name UNIQUE, color
tags             id, name UNIQUE
entry_categories entry_id, category_id
entry_tags       entry_id, tag_id
```

`created_at` ist der stabile Identifier für den bidirektionalen Sync-Merge.

## Sync

Nextcloud WebDAV. `syncNow()` lädt zuerst die Remote-DB herunter, merged via `ATTACH DATABASE` (last-write-wins per Eintrag, `created_at` als Identifier), und lädt die gemergete DB hoch. Erster Sync = nur Upload.

Trigger: App kommt in Vordergrund (AppState-Listener) + expo-background-fetch als best-effort.

Verschlüsselung: Backup als `tagebuch.db.enc` (AES). Schlüssel-Transfer für Restore auf anderem Gerät: Einstellungen → Sicherheit → Schlüssel exportieren / importieren.

## Build

### Cloud (EAS)

```bash
npm run build          # patch-bump + EAS-Build in einem Schritt
npm run build:minor    # minor-bump + EAS-Build
```

Kein expo.dev-Login nötig — `eas.json` ist konfiguriert.

### Lokal (Android Studio)

```bash
source ~/.bashrc       # JAVA_HOME, ANDROID_HOME
npm run bump
npx expo prebuild --platform android --clean
bash scripts/prepare-android.sh
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

## Lizenz

Privates Projekt.
