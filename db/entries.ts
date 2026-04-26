import { getDb } from './schema';

export interface EntryCategory {
  name: string;
  color: string | null;
}

export interface Entry {
  id: number;
  timestamp: number;
  text: string;
  created_at: number;
  updated_at: number;
  mood: number | null;
  health: number | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  categories: EntryCategory[];
  tags: string[];
}

export interface EntryInput {
  timestamp: number;
  text: string;
  categoryIds: number[];
  tagIds: number[];
  mood?: number | null;
  health?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
}

export async function getEntryDatesInMonth(year: number, month: number): Promise<number[]> {
  const db = await getDb();
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  const rows = await db.getAllAsync<{ timestamp: number }>(
    `SELECT timestamp FROM entries WHERE timestamp >= ? AND timestamp <= ?`,
    [start, end]
  );
  return [...new Set(rows.map((r) => new Date(r.timestamp).getDate()))];
}

export async function getEntries(opts?: {
  search?: string;
  categoryIds?: number[];
  tagIds?: number[];
  startTime?: number;
  endTime?: number;
}): Promise<Entry[]> {
  const db = await getDb();

  let query = `
    SELECT DISTINCT e.id, e.timestamp, e.text, e.created_at, e.updated_at,
      e.mood, e.health, e.latitude, e.longitude, e.location_name as locationName
    FROM entries e
  `;
  const joins: string[] = [];
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts?.categoryIds?.length) {
    const placeholders = opts.categoryIds.map(() => '?').join(',');
    joins.push(`JOIN entry_categories ec ON e.id = ec.entry_id AND ec.category_id IN (${placeholders})`);
    params.push(...opts.categoryIds);
  }
  if (opts?.tagIds?.length) {
    const placeholders = opts.tagIds.map(() => '?').join(',');
    joins.push(`JOIN entry_tags et ON e.id = et.entry_id AND et.tag_id IN (${placeholders})`);
    params.push(...opts.tagIds);
  }
  if (opts?.search) {
    conditions.push(`e.text LIKE ?`);
    params.push(`%${opts.search}%`);
  }
  if (opts?.startTime !== undefined) {
    conditions.push(`e.timestamp >= ?`);
    params.push(opts.startTime);
  }
  if (opts?.endTime !== undefined) {
    conditions.push(`e.timestamp <= ?`);
    params.push(opts.endTime);
  }

  query += joins.map((j) => ` ${j}`).join('');
  if (conditions.length > 0) query += ` WHERE ` + conditions.join(` AND `);
  query += ` ORDER BY e.timestamp DESC`;

  const rows = await db.getAllAsync<Omit<Entry, 'categories' | 'tags'>>(query, params);

  return Promise.all(rows.map(async (row) => {
    const categories = await db.getAllAsync<EntryCategory>(
      `SELECT c.name, c.color FROM categories c JOIN entry_categories ec ON c.id = ec.category_id WHERE ec.entry_id = ?`,
      [row.id]
    );
    const tags = await db.getAllAsync<{ name: string }>(
      `SELECT t.name FROM tags t JOIN entry_tags et ON t.id = et.tag_id WHERE et.entry_id = ?`,
      [row.id]
    );
    return {
      ...row,
      categories,
      tags: tags.map((t) => t.name),
    };
  }));
}

export async function getEntry(id: number): Promise<Entry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Omit<Entry, 'categories' | 'tags'>>(
    `SELECT id, timestamp, text, created_at, updated_at, mood, health,
      latitude, longitude, location_name as locationName FROM entries WHERE id = ?`,
    [id]
  );
  if (!row) return null;

  const categories = await db.getAllAsync<EntryCategory>(
    `SELECT c.name, c.color FROM categories c JOIN entry_categories ec ON c.id = ec.category_id WHERE ec.entry_id = ?`,
    [id]
  );
  const tags = await db.getAllAsync<{ name: string }>(
    `SELECT t.name FROM tags t JOIN entry_tags et ON t.id = et.tag_id WHERE et.entry_id = ?`,
    [id]
  );
  return {
    ...row,
    categories,
    tags: tags.map((t) => t.name),
  };
}

export async function createEntry(input: EntryInput): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO entries (timestamp, text, created_at, updated_at, mood, health, latitude, longitude, location_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.timestamp, input.text, now, now,
     input.mood ?? null, input.health ?? null,
     input.latitude ?? null, input.longitude ?? null, input.locationName ?? null]
  );
  const id = result.lastInsertRowId;
  await setEntryRelations(id, input.categoryIds, input.tagIds);
  return id;
}

export async function updateEntry(id: number, input: EntryInput): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `UPDATE entries SET timestamp = ?, text = ?, updated_at = ?,
     mood = ?, health = ?, latitude = ?, longitude = ?, location_name = ? WHERE id = ?`,
    [input.timestamp, input.text, now,
     input.mood ?? null, input.health ?? null,
     input.latitude ?? null, input.longitude ?? null, input.locationName ?? null, id]
  );
  await db.runAsync(`DELETE FROM entry_categories WHERE entry_id = ?`, [id]);
  await db.runAsync(`DELETE FROM entry_tags WHERE entry_id = ?`, [id]);
  await setEntryRelations(id, input.categoryIds, input.tagIds);
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM entries WHERE id = ?`, [id]);
}

async function setEntryRelations(
  entryId: number,
  categoryIds: number[],
  tagIds: number[]
): Promise<void> {
  const db = await getDb();
  for (const cid of categoryIds) {
    await db.runAsync(
      `INSERT OR IGNORE INTO entry_categories (entry_id, category_id) VALUES (?, ?)`,
      [entryId, cid]
    );
  }
  for (const tid of tagIds) {
    await db.runAsync(
      `INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)`,
      [entryId, tid]
    );
  }
}
