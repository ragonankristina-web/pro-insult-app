import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palette, type Colors } from './tokens';

type Scheme = 'light' | 'dark';
type Theme = { c: Colors; dark: boolean; toggle: () => void };

const STORAGE_KEY = 'pro-insult:theme';
const ThemeContext = createContext<Theme | null>(null);

// Тема по умолчанию — как в системе; выбор пользователя запоминается.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [chosen, setChosen] = useState<Scheme | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark') setChosen(v);
      })
      .catch(() => {});
  }, []);

  const dark = (chosen ?? system) === 'dark';
  const toggle = useCallback(() => {
    const next: Scheme = dark ? 'light' : 'dark';
    setChosen(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, [dark]);

  const value = useMemo(() => ({ c: dark ? palette.dark : palette.light, dark, toggle }), [dark, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider>');
  return t;
}
