import 'react-native-get-random-values';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, StyleSheet } from 'react-native';
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
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.72)).current;

  useEffect(() => {
    Animated.spring(logoScale, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();

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

  useEffect(() => {
    if (!ready) return;
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 380,
      delay: 650,
      useNativeDriver: true,
    }).start(() => setShowSplash(false));
  }, [ready]);

  if (showSplash) {
    return (
      <Animated.View style={[splashStyles.container, { opacity: splashOpacity }]}>
        <Animated.Image
          source={require('../assets/icon.png')}
          style={[splashStyles.logo, { transform: [{ scale: logoScale }] }]}
        />
      </Animated.View>
    );
  }

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

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1B2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 28,
  },
});
