## v2.10.15

- Moved sync metadata (timestamps, folder IDs, backup lists) from SecureStore to the SQLite config table — fixes a potential 4 KB limit with long backup lists
- Tombstone pruning: deletion tombstones older than 365 days are automatically cleaned up after each sync
