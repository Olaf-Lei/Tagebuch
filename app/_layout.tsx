import 'react-native-get-random-values';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { BiometricProvider } from '../contexts/BiometricContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { useT } from '../i18n';
import '../sync/backgroundSync'; // registers TaskManager task at module level
import { darkColors, lightColors } from '../components/theme';
import { initDb } from '../db/schema';
import { ensureReminderScheduled } from '../utils/notifications';
import { syncNow, syncIfConfigured, loadConfig, getLastSyncMs } from '../sync/webdav';
import { getAutoSyncInterval, ensureBackgroundSyncRegistered } from '../sync/backgroundSync';

function AppShell() {
  const { mode } = useTheme();
  const t = useT();
  const c = mode === 'dark' ? darkColors : lightColors;

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: t.appName }} />
        <Stack.Screen name="new" options={{ title: t.nav.newEntry, presentation: 'modal' }} />
        <Stack.Screen name="entry/[id]" options={{ title: t.nav.entry }} />
        <Stack.Screen name="settings" options={{ title: t.nav.settings }} />
        <Stack.Screen name="calendar" options={{ title: t.nav.calendar }} />
        <Stack.Screen name="stats" options={{ title: t.nav.stats }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDb().then(() => {
      setReady(true);
      ensureReminderScheduled();
      ensureBackgroundSyncRegistered().catch(() => {});
      syncIfConfigured(); // App-Start
    });

    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background') {
        syncIfConfigured(); // Beenden: letzte Chance, Daten zu sichern
        return;
      }
      if (nextState !== 'active') return;
      // Foreground: nur bei konfiguriertem Intervall und abgelaufener Wartezeit
      try {
        const [config, intervalMin, lastMs] = await Promise.all([
          loadConfig(),
          getAutoSyncInterval(),
          getLastSyncMs(),
        ]);
        if (!config.url || !config.username || !config.password) return;
        if (intervalMin === 0) return;
        if (lastMs !== null && Date.now() - lastMs < intervalMin * 60_000) return;
        syncNow().catch(() => {});
      } catch {}
    });
    return () => sub.remove();
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#0F1B2D' }} />;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <BiometricProvider>
            <AppShell />
          </BiometricProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
