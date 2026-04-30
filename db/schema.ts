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

export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
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

    CREATE TABLE IF NOT EXISTS deleted_entry_ids (
      created_at INTEGER PRIMARY KEY,
      deleted_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS qualifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      emoji_preset TEXT NOT NULL DEFAULT 'mood',
      position INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entry_qualifiers (
      entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
      qualifier_id INTEGER REFERENCES qualifiers(id) ON DELETE CASCADE,
      value INTEGER NOT NULL,
      PRIMARY KEY (entry_id, qualifier_id)
    );

    CREATE TABLE IF NOT EXISTS category_qualifiers (
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      qualifier_id INTEGER REFERENCES qualifiers(id) ON DELETE CASCADE,
      PRIMARY KEY (category_id, qualifier_id)
    );
  `);

  try { await db.execAsync('CREATE TABLE IF NOT EXISTS category_qualifiers (category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE, qualifier_id INTEGER REFERENCES qualifiers(id) ON DELETE CASCADE, PRIMARY KEY (category_id, qualifier_id));'); } catch {}

  // Seed default categories
  await db.execAsync(`
    INSERT OR IGNORE INTO categories (name) VALUES
      ('Tagebuch'), ('Gesundheit'), ('Ernährung'), ('Sport'), ('Befinden');
  `);

  // Seed default qualifiers (idempotent)
  await db.execAsync(`
    INSERT OR IGNORE INTO qualifiers (name, emoji_preset, position) VALUES
      ('Laune', 'mood', 0),
      ('Befinden', 'health', 1);
  `);

  // Migrate mood/health → entry_qualifiers (idempotent via PRIMARY KEY)
  try {
    await db.execAsync(`
      INSERT OR IGNORE INTO entry_qualifiers (entry_id, qualifier_id, value)
      SELECT e.id, q.id, e.mood FROM entries e, qualifiers q
      WHERE q.name = 'Laune' AND e.mood IS NOT NULL;
    `);
  } catch {}
  try {
    await db.execAsync(`
      INSERT OR IGNORE INTO entry_qualifiers (entry_id, qualifier_id, value)
      SELECT e.id, q.id, e.health FROM entries e, qualifiers q
      WHERE q.name = 'Befinden' AND e.health IS NOT NULL;
    `);
  } catch {}

  // Migration: add qualifier and geo columns if not present
  try { await db.execAsync('ALTER TABLE entries ADD COLUMN mood INTEGER;'); } catch {}
  try { await db.execAsync('ALTER TABLE entries ADD COLUMN health INTEGER;'); } catch {}
  try { await db.execAsync('ALTER TABLE entries ADD COLUMN latitude REAL;'); } catch {}
  try { await db.execAsync('ALTER TABLE entries ADD COLUMN longitude REAL;'); } catch {}
  try { await db.execAsync('ALTER TABLE entries ADD COLUMN location_name TEXT;'); } catch {}

  // Migration: add color to categories
  try { await db.execAsync('ALTER TABLE categories ADD COLUMN color TEXT;'); } catch {}
  // Assign palette colors to existing colorless categories
  const _palette = ['#C9A84C','#4C9DC9','#4CC984','#C94C6A','#9D4CC9','#C9844C','#4CC9C9','#C9504C','#84C94C','#C94C9D'];
  const _colorless = await db.getAllAsync<{ id: number }>('SELECT id FROM categories WHERE color IS NULL ORDER BY id');
  for (let _i = 0; _i < _colorless.length; _i++) {
    await db.runAsync('UPDATE categories SET color = ? WHERE id = ?', [_palette[_i % _palette.length], _colorless[_i].id]);
  }
}
