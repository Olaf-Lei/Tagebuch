import { getDb } from './schema';

export interface Category {
  id: number;
  name: string;
}

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>(`SELECT id, name FROM categories ORDER BY name`);
}

export async function createCategory(name: string): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(`INSERT INTO categories (name) VALUES (?)`, [name.trim()]);
  return result.lastInsertRowId;
}

export async function renameCategory(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE categories SET name = ? WHERE id = ?`, [name.trim(), id]);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM categories WHERE id = ?`, [id]);
}
