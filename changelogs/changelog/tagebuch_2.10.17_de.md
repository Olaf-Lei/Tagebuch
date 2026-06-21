## v2.10.17

### Google Drive: Migration auf Web-OAuth-Client

- Android nutzt jetzt dieselbe OAuth-Client-ID wie der Web-Client
- Token-Austausch und Refresh laufen über den serverseitigen Proxy (client_secret bleibt serverseitig)
- Drive-Scope auf `drive.file` reduziert: App sieht nur noch eigene Dateien, kein Vollzugriff auf den Drive
- Alten custom-URI-Scheme-Intent-Filter für den Android-OAuth-Client entfernt
