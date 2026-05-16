import { getDb } from './schema';

export interface Qualifier {
  id: number;
  name: string;
  emoji_preset: string;
  position: number;
  active: number;
}

/** Alle nicht-gelöschten Qualifiers (für Settings-Verwaltung) */
export async function getQualifiers(): Promise<Qualifier[]> {
  const db = await getDb();
  return db.getAllAsync<Qualifier>(
    'SELECT id, name, emoji_preset, position, active FROM qualifiers WHERE deleted = 0 ORDER BY position, id'
  );
}

/** Nur aktive, nicht-gelöschte Qualifiers (für Eintrag-Formulare) */
export async function getActiveQualifiers(): Promise<Qualifier[]> {
  const db = await getDb();
  return db.getAllAsync<Qualifier>(
    'SELECT id, name, emoji_preset, position, active FROM qualifiers WHERE deleted = 0 AND active = 1 ORDER BY position, id'
  );
}

/** Alle nicht-gelöschten Qualifiers inkl. inaktiver (für Stats/Anzeige historischer Daten) */
export async function getAllQualifiersForDisplay(): Promise<Qualifier[]> {
  const db = await getDb();
  return db.getAllAsync<Qualifier>(
    'SELECT id, name, emoji_preset, position, active FROM qualifiers WHERE deleted = 0 ORDER BY position, id'
  );
}

export async function createQualifier(name: string, emojiPreset: string): Promise<number> {
  const db = await getDb();
  const maxRow = await db.getFirstAsync<{ pos: number }>('SELECT MAX(position) as pos FROM qualifiers WHERE deleted = 0');
  const position = (maxRow?.pos ?? -1) + 1;
  const result = await db.runAsync(
    'INSERT INTO qualifiers (name, emoji_preset, position, active, deleted) VALUES (?, ?, ?, 1, 0)',
    [name, emojiPreset, position]
  );
  return result.lastInsertRowId;
}

export async function updateQualifier(id: number, name: string, emojiPreset: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE qualifiers SET name = ?, emoji_preset = ?, updated_at = ? WHERE id = ?',
    [name, emojiPreset, Date.now(), id]
  );
}

export async function setQualifierActive(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE qualifiers SET active = ?, updated_at = ? WHERE id = ?', [active ? 1 : 0, Date.now(), id]);
}

/** Soft-Delete: Qualifier ausblenden, historische entry_qualifiers-Daten bleiben erhalten */
export async function deleteQualifier(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE qualifiers SET deleted = 1, updated_at = ? WHERE id = ?', [Date.now(), id]);
}

export async function reorderQualifiers(ids: number[]): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  for (let i = 0; i < ids.length; i++) {
    await db.runAsync('UPDATE qualifiers SET position = ?, updated_at = ? WHERE id = ?', [i, now, ids[i]]);
  }
}

export async function getEntryQualifierValues(entryId: number): Promise<Record<number, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ qualifier_id: number; value: number }>(
    'SELECT qualifier_id, value FROM entry_qualifiers WHERE entry_id = ?',
    [entryId]
  );
  const result: Record<number, number> = {};
  for (const r of rows) result[r.qualifier_id] = r.value;
  return result;
}

export async function getCategoryQualifierIds(categoryId: number): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ qualifier_id: number }>(
    'SELECT qualifier_id FROM category_qualifiers WHERE category_id = ?',
    [categoryId]
  );
  return rows.map(r => r.qualifier_id);
}

export async function setCategoryQualifiers(categoryId: number, qualifierIds: number[]): Promise<void> {
  const db = await getDb();
  const catRow = await db.getFirstAsync<{ name: string }>('SELECT name FROM categories WHERE id = ?', [categoryId]);
  if (catRow) {
    const newSet = new Set(qualifierIds);
    const currentLinks = await db.getAllAsync<{ qualifier_id: number; qualifier_name: string }>(
      `SELECT cq.qualifier_id, q.name AS qualifier_name
       FROM category_qualifiers cq JOIN qualifiers q ON q.id = cq.qualifier_id
       WHERE cq.category_id = ?`,
      [categoryId],
    );
    const now = Date.now();
    for (const link of currentLinks) {
      if (!newSet.has(link.qualifier_id)) {
        await db.runAsync(
          'INSERT OR REPLACE INTO deleted_category_qualifiers (category_name, qualifier_name, deleted_at) VALUES (?, ?, ?)',
          [catRow.name, link.qualifier_name, now],
        );
      }
    }
  }
  await db.runAsync('DELETE FROM category_qualifiers WHERE category_id = ?', [categoryId]);
  for (const qid of qualifierIds) {
    await db.runAsync(
      'INSERT OR IGNORE INTO category_qualifiers (category_id, qualifier_id) VALUES (?, ?)',
      [categoryId, qid]
    );
  }
  // Tombstones für neu hinzugefügte Links entfernen (Re-Add hebt Löschung auf)
  if (qualifierIds.length > 0 && catRow) {
    const ph = qualifierIds.map(() => '?').join(',');
    await db.runAsync(
      `DELETE FROM deleted_category_qualifiers
       WHERE category_name = ?
         AND qualifier_name IN (SELECT name FROM qualifiers WHERE id IN (${ph}))`,
      [catRow.name, ...qualifierIds],
    );
  }
}

/** Qualifiers für das Formular: kategorie-gebundene zuerst, dann globale (ohne Kategorie-Link). */
export async function getQualifiersForCategories(categoryIds: number[]): Promise<Qualifier[]> {
  const db = await getDb();

  const categoryLinked: Qualifier[] = categoryIds.length > 0
    ? await db.getAllAsync<Qualifier>(
        `SELECT DISTINCT q.id, q.name, q.emoji_preset, q.position, q.active
         FROM qualifiers q JOIN category_qualifiers cq ON cq.qualifier_id = q.id
         WHERE q.deleted = 0 AND q.active = 1
           AND cq.category_id IN (${categoryIds.map(() => '?').join(',')})
         ORDER BY q.position, q.id`,
        categoryIds
      )
    : [];

  const global = await db.getAllAsync<Qualifier>(
    `SELECT id, name, emoji_preset, position, active FROM qualifiers
     WHERE deleted = 0 AND active = 1
       AND NOT EXISTS (SELECT 1 FROM category_qualifiers cq WHERE cq.qualifier_id = id)
     ORDER BY position, id`
  );

  const linkedIds = new Set(categoryLinked.map(q => q.id));
  return [...categoryLinked, ...global.filter(q => !linkedIds.has(q.id))];
}

export async function setEntryQualifierValues(
  entryId: number,
  values: Record<number, number>
): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM entry_qualifiers WHERE entry_id = ?', [entryId]);
  for (const [qid, val] of Object.entries(values)) {
    if (val >= 1 && val <= 5) {
      await db.runAsync(
        'INSERT INTO entry_qualifiers (entry_id, qualifier_id, value) VALUES (?, ?, ?)',
        [entryId, Number(qid), val]
      );
    }
  }
}
