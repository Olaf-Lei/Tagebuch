import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { BiometricProvider } from '../contexts/BiometricContext';
import '../sync/backgroundSync'; // registers TaskManager task at module level
import { darkColors, lightColors } from '../components/theme';
import { initDb } from '../db/schema';

function AppShell() {
  const { mode } = useTheme();
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
        <Stack.Screen name="index" options={{ title: 'Tagebuch' }} />
        <Stack.Screen name="new" options={{ title: 'Neuer Eintrag', presentation: 'modal' }} />
        <Stack.Screen name="entry/[id]" options={{ title: 'Eintrag' }} />
        <Stack.Screen name="settings" options={{ title: 'Einstellungen' }} />
        <Stack.Screen name="calendar" options={{ title: 'Kalender' }} />
        <Stack.Screen name="stats" options={{ title: 'Statistiken' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDb().then(() => setReady(true));
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#111111' }} />;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <BiometricProvider>
          <AppShell />
        </BiometricProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
