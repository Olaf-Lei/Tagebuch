import { deleteAsync, copyAsync } from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { getDb, getDbPath, closeDb, initDb } from '../db/schema';
import { getAllConfig } from '../db/config';
import { decryptToPath } from '../utils/crypto';

export async function applyRestore(tempPath: string, isEnc: boolean): Promise<void> {
  const db = await getDb();
  const rawDbPath = await getDbPath();
  const bakPath = rawDbPath + '.pre_restore.bak';

  // WAL-Checkpoint: alle Daten in Hauptdatei falten (für vollständiges Backup)
  await db.execAsync(`PRAGMA wal_checkpoint(FULL)`);

  // Zu prüfender Pfad: bei Verschlüsselung zuerst entschlüsseln
  const checkRawPath = isEnc ? rawDbPath + '.restore_check.tmp' : tempPath.replace(/^file:\/\//, '');
  let decryptedCheck = false;
  let attached = false;

  try {
    if (isEnc) {
      await decryptToPath(tempPath, checkRawPath);
      decryptedCheck = true;
    }

    await db.execAsync(`ATTACH DATABASE '${checkRawPath}' AS restore_check`);
    attached = true;
    const result = await db.getFirstAsync<{ integrity_check: string }>(
      `PRAGMA restore_check.integrity_check`,
    );
    await db.execAsync(`DETACH DATABASE restore_check`);
    attached = false;

    if (result?.integrity_check !== 'ok') {
      throw new Error(`Backup-Datei beschädigt: ${result?.integrity_check ?? 'unbekannt'}`);
    }
  } finally {
    if (attached) { try { await db.execAsync(`DETACH DATABASE restore_check`); } catch {} }
    if (decryptedCheck) await deleteAsync(`file://${checkRawPath}`, { idempotent: true }).catch(() => {});
  }

  // Aktuelle DB sichern (Rollback-Punkt)
  await copyAsync({ from: `file://${rawDbPath}`, to: `file://${bakPath}` });

  await closeDb();
  try {
    if (isEnc) {
      await decryptToPath(tempPath, rawDbPath);
    } else {
      await deleteAsync(`file://${rawDbPath}`, { idempotent: true });
      await copyAsync({ from: tempPath, to: `file://${rawDbPath}` });
    }
    await deleteAsync(`file://${rawDbPath}-wal`, { idempotent: true }).catch(() => {});
    await deleteAsync(`file://${rawDbPath}-shm`, { idempotent: true }).catch(() => {});
    await initDb();
    const cfg = await getAllConfig();
    await Promise.all(
      Object.entries(cfg).map(([k, v]) => SecureStore.setItemAsync(k, v!)),
    ).catch(() => {});
  } catch (e) {
    // Rollback: gesicherte DB wiederherstellen
    await deleteAsync(`file://${rawDbPath}`, { idempotent: true }).catch(() => {});
    await copyAsync({ from: `file://${bakPath}`, to: `file://${rawDbPath}` }).catch(() => {});
    await deleteAsync(`file://${rawDbPath}-wal`, { idempotent: true }).catch(() => {});
    await deleteAsync(`file://${rawDbPath}-shm`, { idempotent: true }).catch(() => {});
    await initDb().catch(() => {});
    throw e;
  }
}
