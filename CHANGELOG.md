# Changelog

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
