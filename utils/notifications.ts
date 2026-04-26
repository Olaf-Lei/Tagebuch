import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHANNEL_ID = 'daily-reminder';
const KEY_ENABLED = 'reminder_enabled';
const KEY_HOUR = 'reminder_hour';
const KEY_MINUTE = 'reminder_minute';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Tägliche Erinnerung',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function requestPermission(): Promise<boolean> {
  const result = await Notifications.requestPermissionsAsync();
  return (result as any).granted === true || (result as any).status === 'granted';
}

export async function getReminderEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY_ENABLED)) === 'true';
}

export async function getReminderTime(): Promise<{ hour: number; minute: number }> {
  const h = parseInt((await SecureStore.getItemAsync(KEY_HOUR)) ?? '20', 10);
  const m = parseInt((await SecureStore.getItemAsync(KEY_MINUTE)) ?? '0', 10);
  return { hour: isNaN(h) ? 20 : h, minute: isNaN(m) ? 0 : m };
}

export async function scheduleReminder(hour: number, minute: number): Promise<void> {
  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Tagebuch',
      body: 'Hast du heute schon geschrieben?',
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  await SecureStore.setItemAsync(KEY_ENABLED, 'true');
  await SecureStore.setItemAsync(KEY_HOUR, String(hour));
  await SecureStore.setItemAsync(KEY_MINUTE, String(minute));
}

export async function cancelReminder(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await SecureStore.setItemAsync(KEY_ENABLED, 'false');
}

export async function ensureReminderScheduled(): Promise<void> {
  const enabled = await getReminderEnabled();
  if (!enabled) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (scheduled.length > 0) return;
  const { hour, minute } = await getReminderTime();
  await scheduleReminder(hour, minute);
}
