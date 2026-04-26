# Release Signing

## Keystore-Daten

| Feld | Wert |
|---|---|
| Datei | `release/tagebuch-release.jks` |
| Alias | `tagebuch` |
| Gültig bis | ~2053 (10.000 Tage ab Erstellung) |
| Passwort | siehe `keystore.properties` |

## WICHTIG: Backup

**Verlierst du den Keystore oder das Passwort, kannst du die App im Play Store nie mehr updaten.**

Sichere diese zwei Dateien an mindestens zwei getrennten Orten:
- `release/tagebuch-release.jks`
- `release/keystore.properties`

Empfohlen: verschlüsselter USB-Stick + Passwortmanager (z. B. Bitwarden).

Beide Dateien sind in `.gitignore` eingetragen — sie werden nie ins Git-Repository committed.

## SHA-1 Fingerprint (für Play Console)

```bash
source ~/.bashrc && $JAVA_HOME/bin/keytool -list -v \
  -keystore release/tagebuch-release.jks \
  -alias tagebuch \
  -storepass $(grep storePassword release/keystore.properties | cut -d= -f2)
```

## AAB bauen (für Play Store)

```bash
npm run bump                          # Version erhöhen
npx expo prebuild --platform android --clean
bash scripts/prepare-android.sh
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

## APK bauen (für Sideloading)

```bash
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
```
