import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../components/theme';

const STORE_KEY = 'biometric_enabled';

interface BiometricContextValue {
  enabled: boolean;
  available: boolean;
  setEnabled: (v: boolean) => Promise<void>;
}

const BiometricContext = createContext<BiometricContextValue>({
  enabled: false,
  available: false,
  setEnabled: async () => {},
});

export function useBiometric() {
  return useContext(BiometricContext);
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const c = useColors();
  return (
    <View style={[styles.lock, { backgroundColor: c.bg }]}>
      <Text style={[styles.icon]}>🔒</Text>
      <Text style={[styles.title, { color: c.text }]}>Tagebuch gesperrt</Text>
      <Pressable style={[styles.btn, { backgroundColor: c.accent }]} onPress={onUnlock}>
        <Text style={styles.btnText}>Entsperren</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  lock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  icon: { fontSize: 56 },
  title: { fontSize: 20, fontWeight: '600' },
  btn: { borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export function BiometricProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    (async () => {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const isAvailable = hw && enrolled;
      setAvailable(isAvailable);

      const stored = await SecureStore.getItemAsync(STORE_KEY);
      if (isAvailable && stored === 'true') {
        setEnabledState(true);
        setLocked(true);
      }
    })();
  }, []);

  const authenticate = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Tagebuch entsperren',
      cancelLabel: 'Abbrechen',
      disableDeviceFallback: false,
    });
    if (result.success) setLocked(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  // Trigger native prompt whenever locked becomes true
  useEffect(() => {
    if (locked) authenticate();
  }, [locked, authenticate]);

  const setEnabled = async (v: boolean) => {
    await SecureStore.setItemAsync(STORE_KEY, v ? 'true' : 'false');
    setEnabledState(v);
    if (!v) setLocked(false);
  };

  return (
    <BiometricContext.Provider value={{ enabled, available, setEnabled }}>
      {locked ? <LockScreen onUnlock={authenticate} /> : children}
    </BiometricContext.Provider>
  );
}
