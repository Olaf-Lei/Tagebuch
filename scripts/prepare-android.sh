#!/usr/bin/env bash
# Run after: npx expo prebuild --platform android --clean
# Patches gradle.properties for local builds (8 GB RAM, Gradle 8.x)
set -e

PROPS="android/gradle.properties"
WRAPPER="android/gradle/wrapper/gradle-wrapper.properties"
BUILD_GRADLE="android/app/build.gradle"
KS_PROPS="release/keystore.properties"

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
if ! grep -q "splits {" "$BUILD_GRADLE"; then
  sed -i '/androidResources {/i\    splits {\n        abi {\n            enable true\n            reset()\n            include '"'"'arm64-v8a'"'"'\n            universalApk false\n        }\n    }' "$BUILD_GRADLE"
fi

# Release signing (only if keystore.properties exists)
if [ -f "$KS_PROPS" ]; then
  STORE_FILE=$(grep storeFile     "$KS_PROPS" | cut -d= -f2 | tr -d ' ')
  STORE_PW=$(  grep storePassword "$KS_PROPS" | cut -d= -f2 | tr -d ' ')
  KEY_ALIAS=$( grep keyAlias      "$KS_PROPS" | cut -d= -f2 | tr -d ' ')
  KEY_PW=$(    grep keyPassword   "$KS_PROPS" | cut -d= -f2 | tr -d ' ')

  python3 - "$BUILD_GRADLE" "$STORE_FILE" "$STORE_PW" "$KEY_ALIAS" "$KEY_PW" <<'PYEOF'
import sys, re

path, store_file, store_pw, key_alias, key_pw = sys.argv[1:]

with open(path) as f:
    src = f.read()

if 'tagebuch-release' in src:
    print("Release signing already configured.")
    sys.exit(0)

# 1. Inject release signingConfig block after the opening of signingConfigs {
release_cfg = (
    f"        release {{\n"
    f"            storeFile file('{store_file}')\n"
    f"            storePassword '{store_pw}'\n"
    f"            keyAlias '{key_alias}'\n"
    f"            keyPassword '{key_pw}'\n"
    f"        }}\n"
)
src = src.replace("    signingConfigs {\n", "    signingConfigs {\n" + release_cfg, 1)

# 2. In buildTypes.release block, switch to signingConfigs.release.
#    Anchor: the line "signingConfig signingConfigs.debug" that follows the
#    Play-Store comment in the release block.
src = src.replace(
    "            // Caution! In production, you need to generate your own keystore file.\n"
    "            // see https://reactnative.dev/docs/signed-apk-android.\n"
    "            signingConfig signingConfigs.debug\n",
    "            // Caution! In production, you need to generate your own keystore file.\n"
    "            // see https://reactnative.dev/docs/signed-apk-android.\n"
    "            signingConfig signingConfigs.release\n",
    1
)

with open(path, 'w') as f:
    f.write(src)

print("Release signing configured.")
PYEOF
else
  echo "Warning: $KS_PROPS not found — using debug signing."
fi

echo "android/gradle.properties and wrapper patched for local build."
