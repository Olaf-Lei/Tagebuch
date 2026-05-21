import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AppState, AppStateStatus, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../components/theme';
import { checkFallbackPassword, checkRecoveryCode } from '../utils/auth';
import { useT } from '../i18n';

const STORE_KEY      = 'biometric_enabled';
const BG_TS_KEY      = 'biometric_bg_ts';
const FAIL_COUNT_KEY = 'lock_fail_count';
const FAIL_UNTIL_KEY = 'lock_fail_until';

const DELAYS_S = [0, 5, 15, 30, 60, 300]; // wait after n-th failure (0-indexed)

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
  const t = useT();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<LockMode>(bioAvailable ? 'bio' : 'password');
  const [pw, setPw] = useState('');
  const [recovery, setRecovery] = useState('');
  const [error, setError] = useState('');
  const [failCount, setFailCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const isAuthenticating = useRef(false);

  useEffect(() => {
    (async () => {
      const [countStr, untilStr] = await Promise.all([
        SecureStore.getItemAsync(FAIL_COUNT_KEY),
        SecureStore.getItemAsync(FAIL_UNTIL_KEY),
      ]);
      const count = countStr ? parseInt(countStr, 10) : 0;
      const until = untilStr ? parseInt(untilStr, 10) : 0;
      setFailCount(count);
      const left = Math.ceil((until - Date.now()) / 1000);
      if (left > 0) setSecondsLeft(left);
    })();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft(s => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const recordFail = async (newCount: number) => {
    const delaySec = DELAYS_S[Math.min(newCount - 1, DELAYS_S.length - 1)];
    const until = delaySec > 0 ? Date.now() + delaySec * 1000 : 0;
    await Promise.all([
      SecureStore.setItemAsync(FAIL_COUNT_KEY, String(newCount)),
      SecureStore.setItemAsync(FAIL_UNTIL_KEY, String(until)),
    ]);
    setFailCount(newCount);
    if (delaySec > 0) setSecondsLeft(delaySec);
  };

  const clearFail = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(FAIL_COUNT_KEY),
      SecureStore.deleteItemAsync(FAIL_UNTIL_KEY),
    ]);
  };

  const tryBio = useCallback(async () => {
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.lock.title,
        cancelLabel: t.common.cancel,
        disableDeviceFallback: true,
      });
      if (result.success) {
        onUnlock();
        clearFail().catch(() => {});
      } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
        setMode('password');
      }
    } finally {
      isAuthenticating.current = false;
    }
  }, [onUnlock, t]);

  useEffect(() => {
    if (mode === 'bio' && bioAvailable) {
      const timer = setTimeout(tryBio, 600);
      return () => clearTimeout(timer);
    }
  }, [mode, bioAvailable, tryBio]);

  const tryPassword = async () => {
    if (secondsLeft > 0) return;
    const ok = await checkFallbackPassword(pw);
    if (ok) {
      await clearFail();
      onUnlock();
    } else {
      const newCount = failCount + 1;
      await recordFail(newCount);
      setError(t.lock.errorPassword);
      setPw('');
    }
  };

  const tryRecovery = async () => {
    if (secondsLeft > 0) return;
    const ok = await checkRecoveryCode(recovery);
    if (ok) {
      await clearFail();
      onUnlock();
    } else {
      const newCount = failCount + 1;
      await recordFail(newCount);
      setError(t.lock.errorRecovery);
      setRecovery('');
    }
  };

  const styles = StyleSheet.create({
    outer: { ...StyleSheet.absoluteFillObject, zIndex: 9999, backgroundColor: c.bg },
    inner: {
      paddingTop: insets.top + 48,
      paddingHorizontal: 32,
      paddingBottom: 32,
    },
    iconRow: { alignItems: 'center', gap: 8, marginBottom: 36 },
    icon: { fontSize: 56 },
    title: { fontSize: 20, fontWeight: '600', color: c.text },
    form: { gap: 12 },
    input: {
      backgroundColor: c.surface, color: c.text,
      borderColor: error ? c.danger : c.border,
      borderWidth: 1, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
    },
    btn: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    link: { color: c.muted, fontSize: 14, textAlign: 'center', paddingVertical: 4 },
    error: { color: c.danger, fontSize: 13 },
    lockoutMsg: { color: c.accent, fontSize: 13, textAlign: 'center' },
    inputDisabled: { opacity: 0.5 },
    linkRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 4 },
  });

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        bounces={false}
        contentContainerStyle={styles.inner}
      >
        <View style={styles.iconRow}>
          <Text style={styles.icon}>🔒</Text>
          <Text style={styles.title}>{t.lock.title}</Text>
        </View>

        <View style={styles.form}>
          {mode === 'bio' && (
            <>
              <Pressable style={styles.btn} onPress={tryBio}>
                <Text style={styles.btnText}>{t.lock.btnBiometric}</Text>
              </Pressable>
              <View style={styles.linkRow}>
                <Pressable onPress={() => { setError(''); setMode('password'); }}>
                  <Text style={styles.link}>{t.lock.withPassword}</Text>
                </Pressable>
                <Pressable onPress={() => { setError(''); setMode('recovery'); }}>
                  <Text style={styles.link}>{t.lock.withRecovery}</Text>
                </Pressable>
              </View>
            </>
          )}

          {mode === 'password' && (
            <>
              <TextInput
                style={[styles.input, secondsLeft > 0 && styles.inputDisabled]}
                value={pw}
                onChangeText={(v) => { setPw(v); setError(''); }}
                placeholder={t.lock.pwPlaceholder}
                placeholderTextColor={c.muted}
                secureTextEntry
                autoFocus
                editable={secondsLeft === 0}
                onSubmitEditing={tryPassword}
                returnKeyType="done"
              />
              {secondsLeft > 0
                ? <Text style={styles.lockoutMsg}>{t.lock.lockoutWait} {secondsLeft}s</Text>
                : !!error && <Text style={styles.error}>{error}</Text>
              }
              <Pressable style={[styles.btn, secondsLeft > 0 && styles.btnDisabled]} onPress={tryPassword} disabled={secondsLeft > 0}>
                <Text style={styles.btnText}>{t.lock.btnUnlock}</Text>
              </Pressable>
              <View style={styles.linkRow}>
                {bioAvailable && (
                  <Pressable onPress={() => { setError(''); setMode('bio'); }}>
                    <Text style={styles.link}>{t.lock.biometricShort}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => { setError(''); setMode('recovery'); }}>
                  <Text style={styles.link}>{t.lock.withRecovery}</Text>
                </Pressable>
              </View>
            </>
          )}

          {mode === 'recovery' && (
            <>
              <TextInput
                style={[styles.input, secondsLeft > 0 && styles.inputDisabled]}
                value={recovery}
                onChangeText={(v) => { setRecovery(v.toUpperCase()); setError(''); }}
                placeholder={t.lock.recoveryPlaceholder}
                placeholderTextColor={c.muted}
                autoCapitalize="characters"
                autoFocus
                editable={secondsLeft === 0}
                onSubmitEditing={tryRecovery}
                returnKeyType="done"
              />
              {secondsLeft > 0
                ? <Text style={styles.lockoutMsg}>{t.lock.lockoutWait} {secondsLeft}s</Text>
                : !!error && <Text style={styles.error}>{error}</Text>
              }
              <Pressable style={[styles.btn, secondsLeft > 0 && styles.btnDisabled]} onPress={tryRecovery} disabled={secondsLeft > 0}>
                <Text style={styles.btnText}>{t.lock.btnUnlock}</Text>
              </Pressable>
              <View style={styles.linkRow}>
                {bioAvailable && (
                  <Pressable onPress={() => { setError(''); setMode('bio'); }}>
                    <Text style={styles.link}>{t.lock.biometricShort}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => { setError(''); setMode('password'); }}>
                  <Text style={styles.link}>{t.lock.withPassword}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
        const bgTs = await SecureStore.getItemAsync(BG_TS_KEY);
        const elapsed = bgTs ? Date.now() - parseInt(bgTs, 10) : Infinity;
        if (elapsed > LOCK_DELAY_MS) setLocked(true);
      }
    })();
  }, []);

  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LOCK_DELAY_MS = 15_000;

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        SecureStore.setItemAsync(BG_TS_KEY, Date.now().toString());
        if (!lockTimer.current) {
          lockTimer.current = setTimeout(() => {
            setLocked(true);
            lockTimer.current = null;
          }, LOCK_DELAY_MS);
        }
      } else if (next === 'active') {
        SecureStore.setItemAsync(BG_TS_KEY, '0');
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
