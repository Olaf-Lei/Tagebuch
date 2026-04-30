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
    'UPDATE qualifiers SET name = ?, emoji_preset = ? WHERE id = ?',
    [name, emojiPreset, id]
  );
}

export async function setQualifierActive(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE qualifiers SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
}

/** Soft-Delete: Qualifier ausblenden, historische entry_qualifiers-Daten bleiben erhalten */
export async function deleteQualifier(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE qualifiers SET deleted = 1 WHERE id = ?', [id]);
}

export async function reorderQualifiers(ids: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < ids.length; i++) {
    await db.runAsync('UPDATE qualifiers SET position = ? WHERE id = ?', [i, ids[i]]);
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
