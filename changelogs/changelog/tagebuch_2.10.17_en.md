## v2.10.17

### Google Drive: Migration to shared Web OAuth client

- Android now uses the same OAuth client ID as the web client
- Token exchange and refresh are routed through the server-side proxy (client_secret stays server-side)
- Drive scope reduced to `drive.file`: app can only access its own files, no full Drive access
- Removed legacy custom-URI-scheme intent filter for the old Android OAuth client
