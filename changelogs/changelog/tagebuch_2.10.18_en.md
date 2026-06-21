## v2.10.18

### Google Drive: OAuth redirect fix for Android

- Android OAuth flow now uses a proxy callback instead of a direct https redirect
- Google redirects to `proxy.php?action=oauth_callback` after login, which forwards app-internally to `tagebuch://oauth2redirect`
- Chrome Custom Tabs now closes correctly after login
