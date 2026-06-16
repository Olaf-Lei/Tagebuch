# Tagebuch v2.10.9

## Bug Fix

- **Screenshots explicitly allowed**: Removed `expo-screen-capture`. The package declared `READ_MEDIA_IMAGES` and `READ_EXTERNAL_STORAGE` permissions that the app does not need. Screenshots are now explicitly permitted via `android:screenCaptureAllowed="true"` in the manifest.
