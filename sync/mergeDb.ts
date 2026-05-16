import { deleteAsync } from 'expo-file-system/legacy';
import { getDb } from '../db/schema';
import { exportEncKey, decryptToPath } from '../utils/crypto';
import { appendLog } from './syncLog';

export async function mergeRemoteDb(
  tempDownRaw: string,
  remoteIsEnc: boolean,
  dbDir: string,
): Promise<number> {
  let decryptedTempPath: string | null = null;
  let attached = false;
  const db = await getDb();

  try {
    let attachPath = tempDownRaw;

    if (remoteIsEnc) {
      const key = await exportEncKey();
      if (!key) {
        const msg =
          'Remote-DB ist verschlüsselt, aber kein Schlüssel vorhanden.\n\n' +
          'Einstellungen → Sicherheit → Schlüssel exportieren (Gerät 1) → Schlüssel importieren (dieses Gerät).';
        await appendLog('error', msg);
        throw new Error(msg);
      }
      const decryptedRaw = `${dbDir}tagebuch_merge_dec.tmp`;
      decryptedTempPath = `file://${decryptedRaw}`;
      await decryptToPath(`file://${tempDownRaw}`, decryptedTempPath);
      attachPath = decryptedRaw;
    }

    await appendLog('info', `ATTACH: ${attachPath}`);
    await db.execAsync(`ATTACH DATABASE '${attachPath}' AS remote`);
    attached = true;

    const integrityRow = await db.getFirstAsync<{ integrity_check: string }>(
      `PRAGMA remote.integrity_check`,
    );
    if (integrityRow?.integrity_check !== 'ok') {
      const msg = `Remote-DB ist beschädigt: ${integrityRow?.integrity_check ?? 'unbekannt'}`;
      await appendLog('error', msg);
      throw new Error(msg);
    }

    const schemaCheck = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM remote.sqlite_master WHERE type='table' AND name='entries'`,
    );
    if ((schemaCheck?.cnt ?? 0) === 0) {
      await appendLog('info', 'Remote-DB hat kein gültiges Schema — überspringe Merge.');
      return 0;
    }

    const row = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM remote.entries
       WHERE created_at NOT IN (SELECT created_at FROM entries)
         AND created_at NOT IN (SELECT created_at FROM deleted_entry_ids)`,
    );
    const newCount = row?.cnt ?? 0;

    const hasRemoteQualifiers =
      ((await db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM remote.sqlite_master WHERE type='table' AND name='qualifiers'`,
      ))?.cnt ?? 0) > 0;

    const hasRemoteCatQualifiers =
      hasRemoteQualifiers &&
      ((await db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM remote.sqlite_master WHERE type='table' AND name='category_qualifiers'`,
      ))?.cnt ?? 0) > 0;

    const hasRemoteTombstones =
      ((await db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM remote.sqlite_master WHERE type='table' AND name='deleted_entry_ids'`,
      ))?.cnt ?? 0) > 0;

    const hasRemoteCatTombstones =
      ((await db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM remote.sqlite_master WHERE type='table' AND name='deleted_category_names'`,
      ))?.cnt ?? 0) > 0;

    const hasRemoteTagTombstones =
      ((await db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM remote.sqlite_master WHERE type='table' AND name='deleted_tag_names'`,
      ))?.cnt ?? 0) > 0;

    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        INSERT OR IGNORE INTO categories (name, color)
        SELECT name, color FROM remote.categories
        WHERE name NOT IN (SELECT name FROM deleted_category_names)
      `);
      await db.execAsync(`
        UPDATE categories
        SET color = (SELECT rc.color FROM remote.categories rc WHERE rc.name = categories.name)
        WHERE EXISTS (SELECT 1 FROM remote.categories rc WHERE rc.name = categories.name AND rc.color IS NOT NULL)
          AND (categories.color IS NULL OR categories.color != (SELECT rc.color FROM remote.categories rc WHERE rc.name = categories.name))
      `);
      await db.execAsync(`
        INSERT OR IGNORE INTO tags (name)
        SELECT name FROM remote.tags
        WHERE name NOT IN (SELECT name FROM deleted_tag_names)
      `);

      if (hasRemoteQualifiers) {
        await db.execAsync(`
          INSERT OR IGNORE INTO qualifiers (name, emoji_preset, position, active, deleted)
          SELECT name, emoji_preset, position, active, deleted FROM remote.qualifiers
          WHERE name NOT IN (SELECT name FROM qualifiers)
        `);
      }

      // Skip entries that are deleted locally or remotely
      await db.execAsync(`
        INSERT INTO entries (timestamp, text, created_at, updated_at, mood, health, latitude, longitude, location_name)
        SELECT re.timestamp, re.text, re.created_at, re.updated_at, re.mood, re.health, re.latitude, re.longitude, re.location_name
        FROM remote.entries re
        WHERE re.created_at NOT IN (SELECT created_at FROM entries)
          AND re.created_at NOT IN (SELECT created_at FROM deleted_entry_ids)
      `);

      // Clear junction tables for entries where remote is newer
      await db.execAsync(`
        DELETE FROM entry_categories WHERE entry_id IN (
          SELECT le.id FROM entries le
          JOIN remote.entries re ON re.created_at = le.created_at
          WHERE re.updated_at > le.updated_at
        )
      `);
      await db.execAsync(`
        DELETE FROM entry_tags WHERE entry_id IN (
          SELECT le.id FROM entries le
          JOIN remote.entries re ON re.created_at = le.created_at
          WHERE re.updated_at > le.updated_at
        )
      `);
      if (hasRemoteQualifiers) {
        await db.execAsync(`
          DELETE FROM entry_qualifiers WHERE entry_id IN (
            SELECT le.id FROM entries le
            JOIN remote.entries re ON re.created_at = le.created_at
            WHERE re.updated_at > le.updated_at
          )
        `);
      }

      await db.execAsync(`
        UPDATE entries SET
          timestamp=(SELECT re.timestamp FROM remote.entries re WHERE re.created_at=entries.created_at),
          text=(SELECT re.text FROM remote.entries re WHERE re.created_at=entries.created_at),
          updated_at=(SELECT re.updated_at FROM remote.entries re WHERE re.created_at=entries.created_at),
          mood=(SELECT re.mood FROM remote.entries re WHERE re.created_at=entries.created_at),
          health=(SELECT re.health FROM remote.entries re WHERE re.created_at=entries.created_at),
          latitude=(SELECT re.latitude FROM remote.entries re WHERE re.created_at=entries.created_at),
          longitude=(SELECT re.longitude FROM remote.entries re WHERE re.created_at=entries.created_at),
          location_name=(SELECT re.location_name FROM remote.entries re WHERE re.created_at=entries.created_at)
        WHERE created_at IN (
          SELECT re.created_at FROM remote.entries re
          WHERE re.updated_at > (SELECT le.updated_at FROM entries le WHERE le.created_at=re.created_at)
        )
      `);

      await db.execAsync(`
        INSERT OR IGNORE INTO entry_categories (entry_id, category_id)
        SELECT le.id, lc.id
        FROM remote.entry_categories rec
        JOIN remote.entries re ON re.id = rec.entry_id
        JOIN remote.categories rc ON rc.id = rec.category_id
        JOIN entries le ON le.created_at = re.created_at
        JOIN categories lc ON lc.name = rc.name
      `);
      await db.execAsync(`
        INSERT OR IGNORE INTO entry_tags (entry_id, tag_id)
        SELECT le.id, lt.id
        FROM remote.entry_tags ret
        JOIN remote.entries re ON re.id = ret.entry_id
        JOIN remote.tags rt ON rt.id = ret.tag_id
        JOIN entries le ON le.created_at = re.created_at
        JOIN tags lt ON lt.name = rt.name
      `);
      if (hasRemoteQualifiers) {
        await db.execAsync(`
          INSERT OR IGNORE INTO entry_qualifiers (entry_id, qualifier_id, value)
          SELECT le.id, lq.id, req.value
          FROM remote.entry_qualifiers req
          JOIN remote.qualifiers rq ON rq.id = req.qualifier_id
          JOIN remote.entries re ON re.id = req.entry_id
          JOIN entries le ON le.created_at = re.created_at
          JOIN qualifiers lq ON lq.name = rq.name
        `);
      }
      if (hasRemoteCatQualifiers) {
        await db.execAsync(`
          INSERT OR IGNORE INTO category_qualifiers (category_id, qualifier_id)
          SELECT lc.id, lq.id
          FROM remote.category_qualifiers rcq
          JOIN remote.categories rc ON rc.id = rcq.category_id
          JOIN remote.qualifiers rq ON rq.id = rcq.qualifier_id
          JOIN categories lc ON lc.name = rc.name
          JOIN qualifiers lq ON lq.name = rq.name
        `);
      }

      if (hasRemoteTombstones) {
        await db.execAsync(`INSERT OR IGNORE INTO deleted_entry_ids (created_at, deleted_at) SELECT created_at, deleted_at FROM remote.deleted_entry_ids`);
        await db.execAsync(`DELETE FROM entries WHERE created_at IN (SELECT created_at FROM deleted_entry_ids)`);
      }
      if (hasRemoteCatTombstones) {
        await db.execAsync(`INSERT OR IGNORE INTO deleted_category_names (name, deleted_at) SELECT name, deleted_at FROM remote.deleted_category_names`);
        await db.execAsync(`DELETE FROM categories WHERE name IN (SELECT name FROM deleted_category_names)`);
      }
      if (hasRemoteTagTombstones) {
        await db.execAsync(`INSERT OR IGNORE INTO deleted_tag_names (name, deleted_at) SELECT name, deleted_at FROM remote.deleted_tag_names`);
        await db.execAsync(`DELETE FROM tags WHERE name IN (SELECT name FROM deleted_tag_names)`);
      }
    });

    await db.execAsync(`DETACH DATABASE remote`);
    attached = false;
    await appendLog('info', `Merge: ${newCount} neue Einträge importiert.`);
    return newCount;
  } catch (e: any) {
    const msg = `Merge fehlgeschlagen: ${e?.message ?? String(e)}`;
    if (!String(e?.message).startsWith('Merge fehlgeschlagen')) await appendLog('error', msg);
    throw new Error(msg);
  } finally {
    if (attached) { try { await db.execAsync(`DETACH DATABASE remote`); } catch {} }
    if (decryptedTempPath) await deleteAsync(decryptedTempPath, { idempotent: true }).catch(() => {});
  }
}
