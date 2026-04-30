#!/bin/bash
set -e
cd "$(dirname "$0")"
source ~/.bashrc

MODE="${1:---quick}"

if [ "$MODE" = "--full" ]; then
  npx expo prebuild --platform android --clean
  bash scripts/prepare-android.sh
fi

cd android && ./gradlew assembleRelease
cd ..

VERSION=$(node -p "require('./package.json').version")
DEST="/media/Daten/KI/apps/tagebuch/tagebuch_${VERSION}.apk"
APK=$(find android/app/build/outputs/apk/release -name "*.apk" | head -1)
cp "$APK" "$DEST"
echo "Fertig: $DEST"
