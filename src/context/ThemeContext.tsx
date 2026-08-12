import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
 theme: ThemeMode;
 setTheme: (theme: ThemeMode) => void;
 isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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

export const useTheme = (): ThemeContextType => {
 const context = useContext(ThemeContext);
 if (!context) throw new Error('useTheme must be used within a ThemeProvider');
 return context;
};
