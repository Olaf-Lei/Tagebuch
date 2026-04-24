import { getDb } from './schema';

export interface Tag {
  id: number;
  name: string;
}

export async function getTags(): Promise<Tag[]> {
  const db = await getDb();
  return db.getAllAsync<Tag>(`SELECT id, name FROM tags ORDER BY name`);
}

export async function upsertTag(name: string): Promise<number> {
  const db = await getDb();
  const trimmed = name.trim().toLowerCase();
  await db.runAsync(`INSERT OR IGNORE INTO tags (name) VALUES (?)`, [trimmed]);
  const row = await db.getFirstAsync<{ id: number }>(`SELECT id FROM tags WHERE name = ?`, [trimmed]);
  return row!.id;
}

export async function renameTag(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE tags SET name = ? WHERE id = ?`, [name.trim().toLowerCase(), id]);
}

export async function deleteTag(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM tags WHERE id = ?`, [id]);
}

export async function searchTags(query: string): Promise<Tag[]> {
  const db = await getDb();
  return db.getAllAsync<Tag>(
    `SELECT id, name FROM tags WHERE name LIKE ? ORDER BY name LIMIT 10`,
    [`%${query.toLowerCase()}%`]
  );
}
