import { useContext } from 'react';
import { ThemeContext, type ThemeContextType, type ThemeMode } from '../context/theme-context';

export type { ThemeMode, ThemeContextType };

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
