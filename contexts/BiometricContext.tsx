import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AppState, AppStateStatus, Pressable, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { useColors } from '../components/theme';
import { checkFallbackPassword } from '../utils/auth';

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

type LockMode = 'bio' | 'password';

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const c = useColors();
  const [mode, setMode] = useState<LockMode>('bio');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  const tryBio = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Tagebuch entsperren',
      cancelLabel: 'Passwort verwenden',
      disableDeviceFallback: true,
    });
    if (result.success) {
      onUnlock();
    } else {
      setMode('password');
    }
  }, [onUnlock]);

  useEffect(() => { tryBio(); }, [tryBio]);

  const tryPassword = async () => {
    const ok = await checkFallbackPassword(pw);
    if (ok) {
      onUnlock();
    } else {
      setError('Falsches Passwort');
      setPw('');
    }
  };

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      <Text style={s.icon}>🔒</Text>
      <Text style={[s.title, { color: c.text }]}>Tagebuch gesperrt</Text>

      {mode === 'bio' ? (
        <>
          <Pressable style={[s.btn, { backgroundColor: c.accent }]} onPress={tryBio}>
            <Text style={s.btnText}>Biometrie verwenden</Text>
          </Pressable>
          <Pressable onPress={() => setMode('password')}>
            <Text style={[s.link, { color: c.muted }]}>Mit Passwort entsperren</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            style={[s.input, { backgroundColor: c.surface, color: c.text, borderColor: error ? c.danger : c.border }]}
            value={pw}
            onChangeText={(v) => { setPw(v); setError(''); }}
            placeholder="Passwort"
            placeholderTextColor={c.muted}
            secureTextEntry
            autoFocus
            onSubmitEditing={tryPassword}
            returnKeyType="done"
          />
          {!!error && <Text style={[s.error, { color: c.danger }]}>{error}</Text>}
          <Pressable style={[s.btn, { backgroundColor: c.accent }]} onPress={tryPassword}>
            <Text style={s.btnText}>Entsperren</Text>
          </Pressable>
          <Pressable onPress={tryBio}>
            <Text style={[s.link, { color: c.muted }]}>Biometrie verwenden</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  icon: { fontSize: 56 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  btn: { borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, width: '100%', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { fontSize: 14, marginTop: 4 },
  input: { width: '100%', borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { fontSize: 13, alignSelf: 'flex-start' },
});

export function BiometricProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    (async () => {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setAvailable(hw && enrolled);
      const stored = await SecureStore.getItemAsync(STORE_KEY);
      if (stored === 'true') {
        setEnabledState(true);
        setLocked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  const setEnabled = async (v: boolean) => {
    await SecureStore.setItemAsync(STORE_KEY, v ? 'true' : 'false');
    setEnabledState(v);
    if (!v) setLocked(false);
  };

  return (
    <BiometricContext.Provider value={{ enabled, available, setEnabled }}>
      {locked ? <LockScreen onUnlock={() => setLocked(false)} /> : children}
    </BiometricContext.Provider>
  );
}
