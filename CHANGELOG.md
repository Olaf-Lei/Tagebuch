# Changelog

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
