#!/usr/bin/env bash
# Run after: npx expo prebuild --platform android --clean
# Patches gradle.properties for local builds (8 GB RAM, Gradle 8.x)
set -e

PROPS="android/gradle.properties"
WRAPPER="android/gradle/wrapper/gradle-wrapper.properties"

if [ ! -f "$PROPS" ]; then
  echo "Error: $PROPS not found. Run 'npx expo prebuild --platform android' first."
  exit 1
fi

# Memory & parallelism
sed -i 's/org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m/' "$PROPS"
grep -q "org.gradle.daemon" "$PROPS" \
  && sed -i 's/org.gradle.daemon=.*/org.gradle.daemon=true/' "$PROPS" \
  || echo "org.gradle.daemon=true" >> "$PROPS"
grep -q "org.gradle.parallel" "$PROPS" \
  && sed -i 's/org.gradle.parallel=.*/org.gradle.parallel=true/' "$PROPS" \
  || echo "org.gradle.parallel=true" >> "$PROPS"

# Gradle 8.13 (Gradle 9 removed IBM_SEMERU used by RN plugin)
sed -i 's|gradle-[0-9.]*-bin.zip|gradle-8.13-bin.zip|' "$WRAPPER"

# ABI split: arm64-v8a only → ~35 MB statt ~90 MB Fat-APK
BUILD_GRADLE="android/app/build.gradle"
if ! grep -q "splits {" "$BUILD_GRADLE"; then
  sed -i '/androidResources {/i\    splits {\n        abi {\n            enable true\n            reset()\n            include '"'"'arm64-v8a'"'"'\n            universalApk false\n        }\n    }' "$BUILD_GRADLE"
fi

echo "android/gradle.properties and wrapper patched for local build."
