import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '../db/schema';

export default function RootLayout() {
  useEffect(() => { initDb(); }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#111111' },
          headerTintColor: '#e8e8e8',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#111111' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Tagebuch' }} />
        <Stack.Screen name="new" options={{ title: 'Neuer Eintrag', presentation: 'modal' }} />
        <Stack.Screen name="entry/[id]" options={{ title: 'Eintrag' }} />
        <Stack.Screen name="settings" options={{ title: 'Einstellungen' }} />
      </Stack>
    </>
  );
}
