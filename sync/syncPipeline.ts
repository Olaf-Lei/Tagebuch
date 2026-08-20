import { deleteAsync } from 'expo-file-system/legacy';
import { getDb } from '../db/schema';
import { isEncryptionEnabled, encryptDbToTemp, exportEncKey } from '../utils/crypto';
import { appendLog } from './syncLog';
import { applyRestore } from './restoreHelper';

const ENC_KEY_MISSING =
  'Backup ist verschlüsselt, aber kein Schlüssel vorhanden.\n\n' +
  'Einstellungen → Sicherheit → Schlüssel exportieren (Gerät 1) → Schlüssel importieren (dieses Gerät).';

export async function checkIntegrityAndCheckpoint(): Promise<void> {
  const db = await getDb();
  const localCheck = await db.getFirstAsync<{ integrity_check: string }>(`PRAGMA integrity_check`);
  if (localCheck?.integrity_check !== 'ok') {
    const details = localCheck?.integrity_check ?? 'unbekannt';
    await appendLog('error', `Lokale DB beschädigt, Upload abgebrochen: ${details}`);
    throw new Error(`local_corrupt: ${details}`);
  }
  const cp = await db.getFirstAsync<{ busy: number; log: number; checkpointed: number }>(
    `PRAGMA wal_checkpoint(FULL)`,
  );
  if (cp && cp.log !== cp.checkpointed) {
    await appendLog('warn', `WAL-Checkpoint unvollständig (${cp.checkpointed}/${cp.log}), retry…`);
    const cp2 = await db.getFirstAsync<{ busy: number; log: number; checkpointed: number }>(
      `PRAGMA wal_checkpoint(FULL)`,
    );
    if (cp2 && cp2.log !== cp2.checkpointed) {
      const msg = `WAL-Checkpoint fehlgeschlagen (${cp2.checkpointed}/${cp2.log}) — Upload abgebrochen`;
      await appendLog('error', msg);
      throw new Error(msg);
    }
  }
}

export async function prepareUpload(rawDbPath: string): Promise<{
  uploadPath: string;
  filename: string;
  encrypted: boolean;
  cleanup: () => Promise<void>;
}> {
  const encrypted = await isEncryptionEnabled();
  const filename = encrypted ? 'tagebuch.db.enc' : 'tagebuch.db';
  let uploadPath = rawDbPath;
  let tempUpPath: string | null = null;
  if (encrypted) {
    try {
      tempUpPath = await encryptDbToTemp(rawDbPath);
      uploadPath = tempUpPath;
    } catch (e: any) {
      const msg = `Verschlüsselung fehlgeschlagen: ${e?.message ?? String(e)}`;
      await appendLog('error', msg);
      throw new Error(msg);
    }
  }
  return {
    uploadPath,
    filename,
    encrypted,
    cleanup: async () => {
      if (tempUpPath) await deleteAsync(`file://${tempUpPath}`, { idempotent: true }).catch(() => {});
    },
  };
}

export function syncTimestamp(): string {
  return new Date().toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export async function checkEncKey(): Promise<void> {
  const key = await exportEncKey();
  if (!key) throw new Error(ENC_KEY_MISSING);
}

export async function applyRestoreWithCleanup(tempPath: string, isEncFile: boolean): Promise<void> {
  if (isEncFile) {
    const key = await exportEncKey();
    if (!key) {
      await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
      await appendLog('error', ENC_KEY_MISSING);
      throw new Error(ENC_KEY_MISSING);
    }
  }
  try {
    await applyRestore(tempPath, isEncFile);
  } catch (e: any) {
    const msg = `Fehler beim Ersetzen der DB: ${e?.message ?? String(e)}`;
    await appendLog('error', msg);
    throw new Error(msg);
  } finally {
    await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
  }
}
