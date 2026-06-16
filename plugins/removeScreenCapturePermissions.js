const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function removeScreenCapturePermissions(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    const toRemove = new Set([
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.DETECT_SCREEN_CAPTURE',
    ]);
    if (manifest['uses-permission']) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (p) => !toRemove.has(p.$?.['android:name'])
      );
    }
    return c;
  });
};
