# Tagebuch-App

**Zweck:** Mobile-first Android-Tagebuch (Expo/RN) + Web-Client (React/Vite), bidirektionaler Sync via Nextcloud WebDAV oder Google Drive. Privacy-first, kein Cloud-Zwang.

## Stack

- **Android:** Expo SDK 55 (RN 0.83), TypeScript, expo-sqlite, expo-secure-store, crypto-js (AES), EAS Build
- **Web:** React 19 + Vite + sql.js (SQLite-WASM), Leaflet, PHP-Proxy auf Manitu
- **Sync:** bidirektionaler Merge (Android) / Download-only (Web), Tombstone-Propagierung

## Build & Deploy

```bash
# Android (lokal, Default):
npm run bump                          # IMMER zuerst — patch automatisch
./bauen.sh                            # baut APK via Android Studio, kopiert an richtigen Ort
./bauen.sh --full                     # bei nativen Abhängigkeiten (package.json deps, app.json plugins)

# Web:
cd web && bash deploy.sh              # nach JEDER Änderung an web/ automatisch ausführen
# Credentials sourcen falls nötig: source /root/.deploy_credentials
```

## Kernprinzip

Ein Eintrag = Zeitstempel + Freitext + Kategorien + Tags + Qualifiers (1–5). Schnelle Eingabe ist das wichtigste UX-Ziel. Kein Raw-SQL in Komponenten — immer über `/db`-Funktionen.

## Coding-Regeln

- Dark Mode bevorzugt, Navy/Gold (`bg:#0F1B2D`, `accent:#C9A84C`)
- Timestamps immer in ms (Android `Date.now()`) — niemals `* 1000` bei Anzeige
- Alle Secrets in `expo-secure-store`, nie in AsyncStorage
- Scope vor Implementierung nennen: "Android-App:" / "Web-Client:" / "Beide:"

## Details on Demand

Per-Projekt Memory-Index lesen für: SQL-Schema, Screens, Sync-Logik, Verschlüsselungsformate, Web-Architektur, Backlog.
`/root/claude/memory/projects/Tagebuch/MEMORY.md`
