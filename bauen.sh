#!/bin/bash
set -e
cd "$(dirname "$0")"
source ~/.bashrc

MODE="${1:---quick}"
BUNDLE="${2}"

TEST_MODE=0
if [ "$MODE" = "--test" ]; then
  TEST_MODE=1
  MODE="--quick"
fi

if [ "$MODE" = "--full" ]; then
  npx expo prebuild --platform android --clean
  bash scripts/prepare-android.sh
fi

VERSION=$(node -p "require('./package.json').version")

GRADLE_FILE="android/app/build.gradle"

if [ "$TEST_MODE" = "1" ]; then
  # applicationIdSuffix ".test" in defaultConfig einfügen (idempotent)
  if ! grep -q 'applicationIdSuffix ".test"' "$GRADLE_FILE"; then
    sed -i '/applicationId /a\        applicationIdSuffix ".test"' "$GRADLE_FILE"
  fi
fi

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
  if [ "$TEST_MODE" = "1" ]; then
    DEST="/media/Daten/KI/apps/tagebuch/tagebuch_${VERSION}_test.apk"
  else
    DEST="/media/Daten/KI/apps/tagebuch/tagebuch_${VERSION}.apk"
  fi
  APK=$(find android/app/build/outputs/apk/release -name "*.apk" | head -1)
  cp "$APK" "$DEST"
  echo "Fertig: $DEST"
fi

if [ "$TEST_MODE" = "1" ]; then
  # applicationIdSuffix wieder entfernen
  sed -i '/applicationIdSuffix ".test"/d' "$GRADLE_FILE"
fi
