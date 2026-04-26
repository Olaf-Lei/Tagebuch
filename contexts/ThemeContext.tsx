import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'dark' | 'light';
export type ThemePreference = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  preference: 'system',
  setPreference: () => {},
});

const STORE_KEY = 'theme_mode';

function resolveMode(pref: ThemePreference): ThemeMode {
  if (pref === 'system') return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  return pref;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [mode, setMode] = useState<ThemeMode>(resolveMode('system'));

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY).then((v) => {
      const pref: ThemePreference =
        v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
      setPreferenceState(pref);
      setMode(resolveMode(pref));
    });
  }, []);

  useEffect(() => {
    if (preference !== 'system') return;
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setMode(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => sub.remove();
  }, [preference]);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    setMode(resolveMode(p));
    SecureStore.setItemAsync(STORE_KEY, p);
  };

  return (
    <ThemeContext.Provider value={{ mode, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
