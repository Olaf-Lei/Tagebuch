# Tagebuch v2.10.9

## Bugfix

- **Screenshots explizit erlaubt**: `expo-screen-capture` wurde entfernt. Das Paket deklarierte `READ_MEDIA_IMAGES`- und `READ_EXTERNAL_STORAGE`-Berechtigungen, die die App nicht benötigt. Screenshots sind jetzt via `android:screenCaptureAllowed="true"` im Manifest ausdrücklich zugelassen.
