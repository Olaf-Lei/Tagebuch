import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AppState, AppStateStatus, KeyboardAvoidingView, Platform,
  Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useColors } from '../components/theme';
import { checkFallbackPassword, checkRecoveryCode } from '../utils/auth';

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

type LockMode = 'bio' | 'password' | 'recovery';

function LockScreen({ onUnlock, bioAvailable }: { onUnlock: () => void; bioAvailable: boolean }) {
  const c = useColors();
  const [mode, setMode] = useState<LockMode>(bioAvailable ? 'bio' : 'password');
  const [pw, setPw] = useState('');
  const [recovery, setRecovery] = useState('');
  const [error, setError] = useState('');

  const tryBio = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Tagebuch entsperren',
      cancelLabel: 'Abbrechen',
      disableDeviceFallback: true,
    });
    if (result.success) {
      onUnlock();
    } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
      setMode('password');
    }
  }, [onUnlock]);

  useEffect(() => {
    if (mode === 'bio' && bioAvailable) {
      const t = setTimeout(tryBio, 150);
      return () => clearTimeout(t);
    }
  }, [mode, bioAvailable, tryBio]);

  const tryPassword = async () => {
    const ok = await checkFallbackPassword(pw);
    if (ok) {
      onUnlock();
    } else {
      setError('Falsches Passwort');
      setPw('');
    }
  };

  const tryRecovery = async () => {
    const ok = await checkRecoveryCode(recovery);
    if (ok) {
      onUnlock();
    } else {
      setError('Ungültiger Recovery-Code');
      setRecovery('');
    }
  };

  const styles = StyleSheet.create({
    outer: { ...StyleSheet.absoluteFillObject, zIndex: 9999, backgroundColor: c.bg },
    header: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8 },
    icon: { fontSize: 56 },
    title: { fontSize: 20, fontWeight: '600', color: c.text },
    body: { padding: 32, gap: 12 },
    input: {
      backgroundColor: c.surface, color: c.text, borderColor: error ? c.danger : c.border,
      borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
    },
    btn: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    link: { color: c.muted, fontSize: 14, textAlign: 'center', paddingVertical: 4 },
    error: { color: c.danger, fontSize: 13 },
    linkRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 4 },
  });

  return (
    <View style={styles.outer}>
      <View style={styles.header}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>Tagebuch gesperrt</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.body}>
          {mode === 'bio' && (
            <>
              <Pressable style={styles.btn} onPress={tryBio}>
                <Text style={styles.btnText}>Biometrie verwenden</Text>
              </Pressable>
              <View style={styles.linkRow}>
                <Pressable onPress={() => { setError(''); setMode('password'); }}>
                  <Text style={styles.link}>Mit Passwort</Text>
                </Pressable>
                <Pressable onPress={() => { setError(''); setMode('recovery'); }}>
                  <Text style={styles.link}>Recovery-Code</Text>
                </Pressable>
              </View>
            </>
          )}

          {mode === 'password' && (
            <>
              <TextInput
                style={styles.input}
                value={pw}
                onChangeText={(v) => { setPw(v); setError(''); }}
                placeholder="Passwort"
                placeholderTextColor={c.muted}
                secureTextEntry
                autoFocus
                onSubmitEditing={tryPassword}
                returnKeyType="done"
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Pressable style={styles.btn} onPress={tryPassword}>
                <Text style={styles.btnText}>Entsperren</Text>
              </Pressable>
              <View style={styles.linkRow}>
                {bioAvailable && (
                  <Pressable onPress={() => { setError(''); setMode('bio'); }}>
                    <Text style={styles.link}>Biometrie</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => { setError(''); setMode('recovery'); }}>
                  <Text style={styles.link}>Recovery-Code</Text>
                </Pressable>
              </View>
            </>
          )}

          {mode === 'recovery' && (
            <>
              <TextInput
                style={styles.input}
                value={recovery}
                onChangeText={(v) => { setRecovery(v.toUpperCase()); setError(''); }}
                placeholder="XXXX-XXXX"
                placeholderTextColor={c.muted}
                autoCapitalize="characters"
                autoFocus
                onSubmitEditing={tryRecovery}
                returnKeyType="done"
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Pressable style={styles.btn} onPress={tryRecovery}>
                <Text style={styles.btnText}>Entsperren</Text>
              </Pressable>
              <View style={styles.linkRow}>
                {bioAvailable && (
                  <Pressable onPress={() => { setError(''); setMode('bio'); }}>
                    <Text style={styles.link}>Biometrie</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => { setError(''); setMode('password'); }}>
                  <Text style={styles.link}>Passwort</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

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

  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LOCK_DELAY_MS = 15_000;

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        if (!lockTimer.current) {
          lockTimer.current = setTimeout(() => {
            setLocked(true);
            lockTimer.current = null;
          }, LOCK_DELAY_MS);
        }
      } else if (next === 'active') {
        if (lockTimer.current) {
          clearTimeout(lockTimer.current);
          lockTimer.current = null;
        }
      }
    });
    return () => {
      sub.remove();
      if (lockTimer.current) {
        clearTimeout(lockTimer.current);
        lockTimer.current = null;
      }
    };
  }, [enabled]);

  const setEnabled = async (v: boolean) => {
    await SecureStore.setItemAsync(STORE_KEY, v ? 'true' : 'false');
    setEnabledState(v);
    if (!v) setLocked(false);
  };

  return (
    <BiometricContext.Provider value={{ enabled, available, setEnabled }}>
      {children}
      {locked && <LockScreen onUnlock={() => setLocked(false)} bioAvailable={available} />}
    </BiometricContext.Provider>
  );
}
