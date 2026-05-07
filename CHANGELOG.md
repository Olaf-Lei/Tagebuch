# Changelog

## v2.7.2 — 2026-05-07
- Biometrie-Lock: Hintergrund-Timestamp in SecureStore — kein Sperren wenn App innerhalb 15s zurückkommt
- Biometrie-Button: Concurrent-Guard + 600ms Verzögerung (statt 150ms) verhindert sofortiges system_cancel

## v2.7.1 — 2026-05-07
- Einstellungen: Web-Frontend URL konfigurierbar (SecureStore `web_frontend_url`)
- Relay-Code-Button nur sichtbar wenn URL gesetzt; nutzt konfigurierte URL statt hardcoded olovenet.de
- QR-Hint zeigt konfigurierte URL an
- deploy.sh: FTP-Credentials auf Umgebungsvariablen umgestellt (öffentliches Repo)

## v2.7.0 — 2026-05-07
- Play Store Vorbereitung: targetSdkVersion 35, minSdkVersion 24, expo-notifications Plugin
- Datenschutzerklärung (DE + EN) erstellt
- Build-Format auf AAB (Android App Bundle) für Play Store umgestellt

## v2.6.7 — 2026-05-06
- Web: Korrupter DB-Upload behoben (WASM-Heap statt DB-Bytes wurde hochgeladen)
- Web: `created_at`/`updated_at` in Millisekunden statt Sekunden
- Web: Google OAuth — PKCE-Verifier in sessionStorage (verhindert "Missing code verifier"-Fehler)
- Web: QR-Scanner auf ZXing mit TRY_HARDER umgestellt; Kamera-Wechsel-Button
- Web + Android: Relay-Code-Login — 6-stelliger Code als Alternative zum QR-Scan (gültig 5 Min.)

## v2.6.1 — 2026-04-30
- Statistiken: Vorperioden-Vergleich unter der Eintragsanzahl-Karte (+/− ggü. Vorperiode)
- Statistiken: Qualifier-Übersichtsleiste (Ø-Wert + Emoji pro aktivem Qualifier)
- Statistiken: Neue Sektion „Bewertungsverteilung" — Mini-Histogramm pro Qualifier (Stufen 1–5)
- Statistiken: Neue Sektion „Muster" — Tageszeit-Verteilung (24 Säulen), Wochentag-Verteilung (Mo–So), Ø Textlänge
- Statistiken: Neue Sektion „Bewertungen nach Kategorie" — Tabelle Emoji-Ø pro Kategorie × Qualifier

## v2.5.16 — 2026-04-28
- Header: 📊/📅/🗺️-Buttons zu einem einzigen 📊-Button zusammengefasst; Tippen öffnet Bubble-Menü mit Statistiken, Kalender und Karte
- EntryCard: Ort-Badge (📍) ist jetzt tippbar und öffnet die Karte; Badge erscheint auch bei Einträgen mit Koordinaten aber ohne Ortsnamen
- Hilfe-Tour: neuer Schritt 7 „Ansichten & Karte" erklärt den 📊-Button und den tippbaren Ort-Badge

## v2.5.15 — 2026-04-28
- Responsives Layout: ab 700px Breite automatisch breite Ansicht (Querformat, ChromeOS, freies Fenster)
- Kalender: ab 700px Kalender links, Tages-Einträge rechts nebeneinander
- Statistiken: ab 700px Blöcke in zwei Spalten, alle vier Stat-Karten in einer Reihe
- Eintrag erstellen/bearbeiten: ab 700px maximal 680px zentriert
- Eintragslist: Filter-Bar und Liste maximal 720px zentriert

## v2.5.14 — 2026-04-28
- Neuer Screen „Karte": alle Einträge mit Standort als Pins auf OpenStreetMap (Leaflet + MarkerCluster)
- Zeitfilter (Heute / Woche / Monat / Alles), Tap auf Marker öffnet Popup mit Datum + Vorschau + „Öffnen"-Button
- 🗺️-Button im Hauptscreen-Header

## v2.5.13 — 2026-04-28
- Tastatur überdeckt Felder nicht mehr: DropdownPicker schließt Tastatur vor dem Öffnen, TagInput scrollt bei erscheinenden Suggestions erneut ans Ende

## v2.5.12 — 2026-04-28
- Google Drive Ordner-Picker: Button-Sichtbarkeit repariert (flexShrink + KeyboardAvoidingView)
- Google Drive Ordner-Picker: Neuen Ordner direkt aus dem Picker anlegen
- Sync-Sektionen (GDrive + Nextcloud): Hinweis wenn Verschlüsselung deaktiviert ist

## v2.5.11 — 2026-04-28
- Google Drive Ordner-Picker: Baumstruktur statt Flachliste; Navigation Ebene für Ebene mit Breadcrumb, Zurück-Button und „Diesen Ordner wählen"

## v2.5.8 — 2026-04-27
- Fix: Google Drive OAuth auf Android-Client umgestellt (kein Client Secret, Reverse-Client-ID-Schema)

## v2.4.14 — 2026-04-27
- Fix: Kategorien-Farben werden beim Sync korrekt übertragen (INSERT enthielt `color`, UPDATE fehlte komplett)

## v2.4.13 — 2026-04-27
- Animierter In-App-Splash-Screen beim Start: Logo federt rein (spring), nach DB-Init kurze Pause, danach fade-out
- „Über die App": App-Icon jetzt 128×128 mit gold-getöntem Schatten

## v2.4.12 — 2026-04-27
- Kategorien-Farben: freier Farbwähler in Settings (40-Farben-Raster + Hex-Eingabe); ersetzt das bisherige Weiterschalten durch die Palette

## v2.4.10 — 2026-04-27
- Fix: Kategorie- und Tag-Änderungen an Einträgen werden jetzt korrekt auf andere Geräte synchronisiert — Junction-Rows werden vor dem Merge-Update gelöscht und aus der Remote-DB neu importiert (war vorher nur INSERT OR IGNORE, Entfernungen wurden ignoriert)

## v2.4.9 — 2026-04-27
- Fix: Gelöschte Einträge werden jetzt beim Sync auf andere Geräte propagiert — Tombstone-Tabelle `deleted_entry_ids` (`created_at` als stabiler Identifier); `deleteEntry()` schreibt Tombstone vor Hard-Delete; Sync-Merge importiert Remote-Tombstones und löscht betroffene lokale Einträge
- Sync-Button (↻) in der Header-Leiste der Eintragsliste — manueller Trigger, zeigt Fortschritt durch Abdimmen
- Auto-Refresh der Eintragsliste nach jedem Sync via `addSyncListener`

## v2.4.8 — 2026-04-26
- Burger-Menü: Settings-Einstieg als ☰-Icon oben links im Header von `index.tsx`; floating Settings-Button (unten links) entfernt

## v2.4.7 — 2026-04-26
- Farben für Kategorien: Auto-Vorgabe aus 10-Farben-Palette (Navy/Gold-kompatibel) beim Anlegen; Tap auf Farbkreis in Settings → Farbe weiterschalten; EntryCard-Badges und DropdownPicker zeigen individuelle Kategoriefarben; Statistik-Balkendiagramm nutzt Kategoriefarben; neue Spalte `color TEXT` in categories per Migration (idempotent, bestehende Kategorien bekommen automatisch Farben)

## v2.4.6 — 2026-04-26
- Sync-Verhalten verbessert: `syncIfConfigured()` feuert bei App-Start, nach jedem gespeicherten/bearbeiteten Eintrag und wenn die App in den Hintergrund geht; zyklischer Foreground-Sync bleibt erhalten (AppState active + Interval-Check)

## v2.4.5 — 2026-04-26
- Tastatur-Scroll: `KeyboardAvoidingView` auf `behavior="padding"` umgestellt (war `height` auf Android), ScrollView-Ref + `scrollToEnd` wenn TagInput-Feld fokussiert wird — aktives Feld bleibt über der Tastatur sichtbar

## v2.4.4 — 2026-04-26
- Fix: WAL checkpoint (`PRAGMA wal_checkpoint(TRUNCATE)`) vor Upload — ohne diesen Schritt enthielt die hochgeladene `.db` nur 1 leere Page, da expo-sqlite alle Writes inkl. Schema zunächst in die `-wal`-Datei schreibt; Nextcloud bekam eine schema-lose DB, Merge schlug fehl, jeder Client sah nur eigene Einträge

## v2.4.3 — 2026-04-26
- Fix: Schema-Check nach ATTACH — Remote-DB ohne entries-Tabelle führte zu "no such table: remote.entries"; Merge wird jetzt übersprungen und lokale DB direkt hochgeladen (wie Erstsync)

## v2.4.2 — 2026-04-26
- Fix: ATTACH DATABASE Pfad in DB-Verzeichnis verlegt — expo-sqlite (native) und expo-file-system (JS) sehen unterschiedliche Basis-Pfade; SQLite fand die Temp-Datei nicht und legte eine leere DB an → "no such table: remote.entries"

## v2.4.1 — 2026-04-26
- Bidirektionaler Sync-Merge via SQLite ATTACH DATABASE (`created_at` als stabiler Identifier)
- Foreground-Trigger für Auto-Sync (AppState-Listener in `_layout.tsx`, zuverlässiger als BackgroundFetch)
- Enc-Key-Export/Import: Schlüssel zwischen Geräten übertragen (Settings → Sicherheit)
- restoreNow() probt `.db.enc` zuerst, dann `.db` — Cross-Device-Restore ohne manuelle Konfiguration
- ensureBackgroundSyncRegistered() beim App-Start

## v2.4.0 — 2026-04-25
- Hilfe-Tour (6 Schritte, Punkte-Navigation, Weiter/Zurück/Fertig)
- `?`-Button im Header, automatisch beim ersten Start
- Tour-Texte vollständig in DE + EN

## v2.3.2 — 2026-04-24
- Mehrsprachigkeit DE/EN vollständig implementiert (useT() Hook, LanguageContext)
- Lock-Screen: KeyboardAvoidingView verhindert Überlagerung durch Tastatur
- Sprach-Auswahl in Settings → Darstellung

## v2.3.1 — 2026-04-23
- Tägliche Erinnerung (expo-notifications): Toggle + Uhrzeit-Picker in Settings
- App-Start prüft geplante Notification, registriert neu falls nötig

## v2.3.0 — 2026-04-22
- Statistiken: Kategorien- und Tag-Balkendiagramme (Top 10)
- ThemeContext: Dritter Modus `system` (folgt Gerät-Einstellung)
- Suchbegriff-Hervorhebung in EntryCard (HighlightedText)

## v2.2.2 — 2026-04-21
- Settings in einklappbare Accordion-Sektionen gegliedert

## v2.2.1 — 2026-04-20
- Recovery Code für "weder Biometrie noch Passwort"-Szenario
- "Über die App" korrigiert, App-Icon angezeigt

## v2.2.0 — 2026-04-19
- Play Store Release-Vorbereitung (Keystore, AAB, Store-Texte, Privacy Policy)
