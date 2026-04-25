# Tagebuch – Projekt-Manifest

Stand: 2026-04-25 | Version: 1.0.0 | Build: EAS Android Preview

---

## Ziel

Mobile-first Android-App zum schnellen, privaten Erfassen persönlicher Log-Einträge.
Kein Konto, kein Drittdienst, kein Cloud-Zwang. Daten gehören dem Nutzer.

**Kernprinzip:** Ein Eintrag = Zeitstempel + Freitext + Kategorien + Tags.
Keine Pflichtfelder außer Text. App öffnen → tippen → speichern in unter 5 Sekunden.

---

## Status

### Fertig (v1)

- [x] SQLite-Schema mit Migrationen
- [x] CRUD: Einträge, Kategorien, Tags
- [x] Eintragsliste: Volltextsuche, Kategorie-Filter, Tag-Filter, Datumsbereich-Filter
- [x] Neuer Eintrag: Autofokus, Kategorie-Chips, Tag-Autocomplete, nativer Datum/Zeit-Picker
- [x] Eintrag bearbeiten mit Lösch-Bestätigung
- [x] Kalenderansicht mit Monatsnavigation und Tages-Einträgen
- [x] Statistik-Screen: KPI-Kacheln, 26-Wochen-Heatmap, Balkendiagramme, Streaks
- [x] JSON- und CSV-Export via expo-sharing
- [x] Nextcloud WebDAV-Sync (manuell) mit URL-Auto-Konstruktion
- [x] Auto-Hintergrundsync (15 Min / 1 Std / 6 Std / 24 Std)
- [x] Hell/Dunkel-Modus (persistent via SecureStore)
- [x] Android Navbar-Inset (SafeAreaProvider + useSafeAreaInsets)
- [x] Kategorien & Tags verwaltbar in Settings (umbenennen, löschen)
- [x] About-Section in Settings
- [x] EAS Build (APK)

### Offen (Backlog)

- [ ] **DB-Verschlüsselung vor WebDAV-Upload**
  Priorität: hoch | Aufwand: L
  Die SQLite-Datei wird aktuell unverschlüsselt übertragen. Vor dem Upload mit einem
  nutzerkontrollierten Schlüssel verschlüsseln (z. B. SQLCipher oder AES über expo-crypto).
  Architektur muss Entschlüsselung beim Restore berücksichtigen.

- [ ] **Biometrie-Lock beim App-Start**
  Priorität: mittel | Aufwand: M
  Fingerabdruck / Gesichtserkennung via `expo-local-authentication`.
  Opt-in in Settings. Greift nur wenn Gerät Biometrie unterstützt.

- [ ] **Restore aus Nextcloud**
  Priorität: mittel | Aufwand: M
  Aktuell nur Upload. Download + lokale DB ersetzen (mit Bestätigungsdialog).

- [ ] **Eintrags-Versionierung**
  Priorität: niedrig | Aufwand: M
  Änderungshistorie pro Eintrag in separater Tabelle (`entry_versions`).
  Ältere Versionen im Edit-Screen anzeigbar.

- [ ] **iOS-Support**
  Priorität: niedrig | Aufwand: S
  Nur Anpassungen im Layout nötig (SafeArea, Picker-Verhalten).
  Kein grundsätzliches Hindernis bekannt.

- [ ] **Anhänge (Bilder)**
  Priorität: niedrig | Aufwand: XL
  Bilder pro Eintrag via `expo-image-picker`. Dateipfade in DB, Binärdaten im Dateisystem.
  Sync-Strategie offen.

---

## Architektur-Richtlinien

### Datenhaltung
- Kein Raw-SQL in Komponenten — ausschließlich über `/db`-Funktionen
- `timestamp` = nutzerkontrollierte Zeit (editierbar)
- `created_at` = Systemzeit beim Anlegen (immutable, nie überschreiben)
- Tags entstehen per Upsert beim ersten Gebrauch, keine separate Anlage nötig
- Credentials (Nextcloud-Passwort, Theme-Einstellung) in `expo-secure-store`, nie in AsyncStorage

### State & Theming
- Kein State-Management-Framework — `useState` + Context reicht
- Theming ausschließlich über `useColors()` + `useMemo(() => StyleSheet.create({...}), [c])`
- Dark Mode ist Standard; Light Mode als opt-in Toggle in Settings
- Keine inline-Styles mit Hardcoded-Farben

### Sync
- `TaskManager.defineTask()` muss auf Modul-Top-Level stehen (Expo-Anforderung)
- WebDAV-URL wird automatisch konstruiert — `/remote.php/dav/files/USERNAME/` wird
  angehängt wenn nicht schon vorhanden
- Fehler aus Sync immer mit `Alert.alert()` anzeigen, nie still schlucken

### Build
- `.npmrc` mit `legacy-peer-deps=true` ist Pflicht (react-dom Peer-Konflikt unter SDK 55)
- `package-lock.json` nur mit `npm install --legacy-peer-deps` generieren
- EAS Build Profile: `preview` für APK, `production` für AAB (Play Store)

### UX-Grundsätze
- Tipp-Targets mindestens 44px
- Eine-Hand-Bedienbarkeit: wichtige Aktionen unten / FAB
- Keine Pflichtfelder außer Eintrag-Text
- Deutsche Sprache in der gesamten UI

---

## Datenmodell (aktuell)

```sql
CREATE TABLE categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp  INTEGER NOT NULL,   -- Unix ms, user-editierbar
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL,   -- Unix ms, gesetzt beim Anlegen, immutable
  updated_at INTEGER NOT NULL
);

CREATE TABLE entry_categories (
  entry_id    INTEGER REFERENCES entries(id)    ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id),
  PRIMARY KEY (entry_id, category_id)
);

CREATE TABLE entry_tags (
  entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
  tag_id   INTEGER REFERENCES tags(id),
  PRIMARY KEY (entry_id, tag_id)
);
```

Seed-Kategorien: Tagebuch, Gesundheit, Ernährung, Sport, Befinden.

Geplante Erweiterung für Versionierung:
```sql
CREATE TABLE entry_versions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id   INTEGER REFERENCES entries(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  saved_at   INTEGER NOT NULL
);
```

---

## Abhängigkeiten (Kern)

| Paket | Version | Zweck |
|---|---|---|
| expo | ~55.0.0 | SDK-Basis |
| expo-router | ~55.0.13 | File-based Navigation |
| expo-sqlite | ~55.0.15 | Lokale Datenbank |
| expo-secure-store | ~55.0.13 | Credentials & Prefs |
| expo-file-system | ~55.0.17 | WebDAV-Upload |
| expo-sharing | ~55.0.18 | Export |
| expo-background-fetch | ~55.0.15 | Hintergrundsync |
| expo-task-manager | ~55.0.15 | Task-Registration |
| @react-native-community/datetimepicker | ^9.1.0 | Nativer Datum/Zeit-Dialog |
| react-native-safe-area-context | ~5.6.2 | Navbar-Insets |
| react | 19.2.0 | |
| react-native | 0.83.6 | |

---

## Explizit ausgeschlossen

- Verschlüsselung in v1 (Architektur muss es später ermöglichen)
- SMB/NFS-Sync
- Automatische iCloud/Google-Drive-Sicherung
- Auswertungen mit externen Charting-Libs (alles in purem RN)
- Bilder/Anhänge in v1
- Biometrie in v1
- iOS in v1
- Passwortschutz in v1
- Push-Notifications
