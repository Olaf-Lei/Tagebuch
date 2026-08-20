import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { getConfig, setConfig } from '../db/config';
import { syncNow } from './webdav';
import { syncNow as gdriveSyncNow } from './googledrive';

export const SYNC_TASK = 'TAGEBUCH_BACKGROUND_SYNC';

// Must be defined at module level
TaskManager.defineTask(SYNC_TASK, async () => {
  let ok = false;
  try { await syncNow(); ok = true; } catch {}
  try { await gdriveSyncNow(); ok = true; } catch {}
  return ok
    ? BackgroundFetch.BackgroundFetchResult.NewData
    : BackgroundFetch.BackgroundFetchResult.Failed;
});

export async function getAutoSyncInterval(): Promise<number> {
  const v = await getConfig('bg_sync_interval');
  return v ? Number(v) : 0;
}

export async function ensureBackgroundSyncRegistered(): Promise<void> {
  const intervalMin = await getAutoSyncInterval();
  if (intervalMin === 0) return;
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK);
  if (!isRegistered) {
    await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
      minimumInterval: intervalMin * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
}

export async function setAutoSyncInterval(minutes: number): Promise<void> {
  await setConfig('bg_sync_interval', String(minutes));
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK);

  if (minutes === 0) {
    if (isRegistered) await BackgroundFetch.unregisterTaskAsync(SYNC_TASK);
    return;
  }

  if (isRegistered) await BackgroundFetch.unregisterTaskAsync(SYNC_TASK);
  await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
    minimumInterval: minutes * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
