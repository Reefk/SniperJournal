'use client';

import { useJournal } from '@/store/JournalProvider';

/**
 * Recharts needs concrete colors rather than CSS variables for SVG fills,
 * so the palette is mirrored here per theme.
 */
export interface ChartTheme {
  grid: string;
  axis: string;
  profit: string;
  loss: string;
  accent: string;
  surface: string;
  text: string;
  muted: string;
}

const DARK: ChartTheme = {
  grid: '#222c42', axis: '#5c6882', profit: '#34d399', loss: '#f43f5e',
  accent: '#818cf8', surface: '#131a2a', text: '#e6eaf2', muted: '#8b97ad',
};

const LIGHT: ChartTheme = {
  grid: '#e2e8f0', axis: '#94a3b8', profit: '#059669', loss: '#e11d48',
  accent: '#4f46e5', surface: '#ffffff', text: '#0f172a', muted: '#64748b',
};

export function useChartTheme(): ChartTheme {
  const { data } = useJournal();
  return data.settings.theme === 'light' ? LIGHT : DARK;
}
