import { getDb } from './schema';

export interface Entry {
  id: number;
  timestamp: number;
  text: string;
  created_at: number;
  updated_at: number;
  categories: string[];
  tags: string[];
}

export interface EntryInput {
  timestamp: number;
  text: string;
  categoryIds: number[];
  tagIds: number[];
}

export async function getEntries(opts?: {
  search?: string;
  categoryId?: number;
  tagId?: number;
}): Promise<Entry[]> {
  const db = await getDb();

  let query = `
    SELECT DISTINCT e.id, e.timestamp, e.text, e.created_at, e.updated_at
    FROM entries e
  `;
  const params: (string | number)[] = [];

  if (opts?.categoryId) {
    query += ` JOIN entry_categories ec ON e.id = ec.entry_id AND ec.category_id = ?`;
    params.push(opts.categoryId);
  }
  if (opts?.tagId) {
    query += ` JOIN entry_tags et ON e.id = et.entry_id AND et.tag_id = ?`;
    params.push(opts.tagId);
  }
  if (opts?.search) {
    query += ` WHERE e.text LIKE ?`;
    params.push(`%${opts.search}%`);
  }

  query += ` ORDER BY e.timestamp DESC`;

  const rows = await db.getAllAsync<Omit<Entry, 'categories' | 'tags'>>(query, params);

  return Promise.all(rows.map(async (row) => {
    const categories = await db.getAllAsync<{ name: string }>(
      `SELECT c.name FROM categories c JOIN entry_categories ec ON c.id = ec.category_id WHERE ec.entry_id = ?`,
      [row.id]
    );
    const tags = await db.getAllAsync<{ name: string }>(
      `SELECT t.name FROM tags t JOIN entry_tags et ON t.id = et.tag_id WHERE et.entry_id = ?`,
      [row.id]
    );
    return {
      ...row,
      categories: categories.map((c) => c.name),
      tags: tags.map((t) => t.name),
    };
  }));
}

export async function getEntry(id: number): Promise<Entry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Omit<Entry, 'categories' | 'tags'>>(
    `SELECT id, timestamp, text, created_at, updated_at FROM entries WHERE id = ?`,
    [id]
  );
  if (!row) return null;

  const categories = await db.getAllAsync<{ name: string }>(
    `SELECT c.name FROM categories c JOIN entry_categories ec ON c.id = ec.category_id WHERE ec.entry_id = ?`,
    [id]
  );
  const tags = await db.getAllAsync<{ name: string }>(
    `SELECT t.name FROM tags t JOIN entry_tags et ON t.id = et.tag_id WHERE et.entry_id = ?`,
    [id]
  );
  return {
    ...row,
    categories: categories.map((c) => c.name),
    tags: tags.map((t) => t.name),
  };
}

export async function createEntry(input: EntryInput): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO entries (timestamp, text, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    [input.timestamp, input.text, now, now]
  );
  const id = result.lastInsertRowId;
  await setEntryRelations(id, input.categoryIds, input.tagIds);
  return id;
}

export async function updateEntry(id: number, input: EntryInput): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `UPDATE entries SET timestamp = ?, text = ?, updated_at = ? WHERE id = ?`,
    [input.timestamp, input.text, now, id]
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
