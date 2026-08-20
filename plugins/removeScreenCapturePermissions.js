const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function allowScreenCapture(config) {
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application?.[0];
    if (app?.$) {
      delete app.$['android:screenCaptureAllowed'];
    }
    return c;
  });
};
