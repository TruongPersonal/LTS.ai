import React, { useEffect, useState } from 'react';
import { ThemeContext, type ThemeMode } from './theme-context';

const resolveIsDark = (theme: ThemeMode) =>
  theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : theme === 'dark';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('lts_theme') as ThemeMode) || 'light';
  });
  const [isDark, setIsDark] = useState<boolean>(() => resolveIsDark(theme));

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;

    const applyTheme = () => {
      const nextIsDark = theme === 'system' ? media.matches : theme === 'dark';
      setIsDark(nextIsDark);
      root.dataset.theme = nextIsDark ? 'dark' : 'light';
      root.style.colorScheme = nextIsDark ? 'dark' : 'light';
    };

    localStorage.setItem('lts_theme', theme);
    applyTheme();

    if (theme === 'system') media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => setThemeState(newTheme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};
