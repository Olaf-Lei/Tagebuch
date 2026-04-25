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
  bg: '#0F1B2D',
  surface: '#1A2D47',
  border: '#2A3F5A',
  text: '#FFFFFF',
  muted: '#8A9BB0',
  accent: '#C9A84C',
  danger: '#e05555',
};

export const lightColors: Colors = {
  bg: '#f2f2f7',
  surface: '#ffffff',
  border: '#d1d1d6',
  text: '#1a1a1a',
  muted: '#8e8e93',
  accent: '#B8943E',
  danger: '#cc3333',
};

export function useColors(): Colors {
  const { mode } = useTheme();
  return useMemo(() => (mode === 'dark' ? darkColors : lightColors), [mode]);
}

// Backwards-compat for static use (DB/sync layer – no UI)
export const colors = darkColors;
