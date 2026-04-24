import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '../db/schema';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDb().then(() => setReady(true));
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#111111' }} />;

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
