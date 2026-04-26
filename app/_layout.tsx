import 'react-native-get-random-values';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
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
    initDb().then(() => { setReady(true); ensureReminderScheduled(); });
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
