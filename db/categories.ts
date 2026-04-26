import { getDb } from './schema';

export const CATEGORY_COLORS = [
  '#C9A84C', // Gold
  '#4C9DC9', // Sky blue
  '#4CC984', // Mint
  '#C94C6A', // Coral
  '#9D4CC9', // Violet
  '#C9844C', // Amber
  '#4CC9C9', // Teal
  '#C9504C', // Tomato
  '#84C94C', // Lime
  '#C94C9D', // Rose
];

export interface Category {
  id: number;
  name: string;
  color: string | null;
}

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>(`SELECT id, name, color FROM categories ORDER BY name`);
}

export async function createCategory(name: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM categories');
  const color = CATEGORY_COLORS[(row?.cnt ?? 0) % CATEGORY_COLORS.length];
  const result = await db.runAsync(`INSERT INTO categories (name, color) VALUES (?, ?)`, [name.trim(), color]);
  return result.lastInsertRowId;
}

export async function renameCategory(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE categories SET name = ? WHERE id = ?`, [name.trim(), id]);
}

export async function updateCategoryColor(id: number, color: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE categories SET color = ? WHERE id = ?`, [color, id]);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM categories WHERE id = ?`, [id]);
}
