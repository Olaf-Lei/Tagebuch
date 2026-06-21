## v2.10.18

### Google Drive: OAuth-Redirect-Fix für Android

- Android-OAuth-Flow nutzt jetzt einen Proxy-Callback statt direktem https-Redirect
- Google redirectet nach Login zu `proxy.php?action=oauth_callback`, der App-intern zu `tagebuch://oauth2redirect` weiterleitet
- Chrome Custom Tabs schließt sich damit korrekt nach dem Login
