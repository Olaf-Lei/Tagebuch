import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('tagebuch.db');
  }
  return _db;
}

export async function getDbPath(): Promise<string> {
  const db = await getDb();
  return db.databasePath;
}

export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entry_categories (
      entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id),
      PRIMARY KEY (entry_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
      tag_id INTEGER REFERENCES tags(id),
      PRIMARY KEY (entry_id, tag_id)
    );
  `);

  // Seed default categories
  await db.execAsync(`
    INSERT OR IGNORE INTO categories (name) VALUES
      ('Tagebuch'), ('Gesundheit'), ('Ernährung'), ('Sport'), ('Befinden');
  `);
}
