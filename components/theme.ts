import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export interface Colors {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  danger: string;
}

export const darkColors: Colors = {
  bg: '#111111',
  surface: '#1e1e1e',
  border: '#2e2e2e',
  text: '#e8e8e8',
  muted: '#888888',
  accent: '#4a9eff',
  danger: '#e05555',
};

export const lightColors: Colors = {
  bg: '#f2f2f7',
  surface: '#ffffff',
  border: '#d1d1d6',
  text: '#1a1a1a',
  muted: '#8e8e93',
  accent: '#0066cc',
  danger: '#cc3333',
};

export function useColors(): Colors {
  const { mode } = useTheme();
  return useMemo(() => (mode === 'dark' ? darkColors : lightColors), [mode]);
}

// Backwards-compat for static use (DB/sync layer – no UI)
export const colors = darkColors;
