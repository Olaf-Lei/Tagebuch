#!/bin/bash
set -e
cd "$(dirname "$0")"
source ~/.bashrc

MODE="${1:---quick}"
BUNDLE="${2}"

if [ "$MODE" = "--full" ]; then
  npx expo prebuild --platform android --clean
  bash scripts/prepare-android.sh
fi

VERSION=$(node -p "require('./package.json').version")

if [ "$BUNDLE" = "--bundle" ] || [ "$MODE" = "--bundle" ]; then
  cd android && ./gradlew bundleRelease
  cd ..
  DEST="/media/Daten/KI/apps/tagebuch/tagebuch_${VERSION}.aab"
  AAB=$(find android/app/build/outputs/bundle/release -name "*.aab" | head -1)
  cp "$AAB" "$DEST"
  echo "Fertig: $DEST"
else
  cd android && ./gradlew assembleRelease
  cd ..
  DEST="/media/Daten/KI/apps/tagebuch/tagebuch_${VERSION}.apk"
  APK=$(find android/app/build/outputs/apk/release -name "*.apk" | head -1)
  cp "$APK" "$DEST"
  echo "Fertig: $DEST"
fi
