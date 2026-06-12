# Tagebuch 2.10 — Release Notes

This update is all about one thing: **keeping your data safe — and keeping it that way.**

---

## What's new?

### Stronger encryption
When you encrypt backups, the app now uses AES-256-GCM — a more modern algorithm that also verifies the file hasn't been tampered with in transit. Your older backups will of course still open fine.

Your app unlock password is now stored much more securely too: instead of a simple hash, the app uses PBKDF2 with 100,000 rounds — making brute-force attacks significantly harder. If you have a password set, it will be automatically upgraded to the new format the next time you unlock.

### More reliable sync
- Files are now fully transferred before being swapped in — no more half-finished uploads sitting on your server.
- If you use the app on multiple devices and someone else made changes in the meantime, the app now detects this and prevents your changes from being silently overwritten.
- Background sync with Nextcloud and Google Drive now runs cleanly one after the other — preventing rare but annoying database errors.

### Automatic daily backups
The app now creates a daily snapshot whenever it syncs. Under **Settings → Sync & Backup → Older Versions** you can browse and restore past versions. You control how long copies are kept (3 to 30 days).

### Restore safety check
Before a backup replaces your current database, the app checks that the downloaded file is intact. If anything goes wrong, the app automatically rolls back — your data stays untouched.

### Screenshots blocked
The app now prevents diary content from appearing in screenshots, screen recordings, or the app switcher preview.

### "Remember me" in the web client
For web journal users: there's now an option to choose whether your login is saved after closing the tab.

---

As always: your data stays on your device. No account, no cloud required.
