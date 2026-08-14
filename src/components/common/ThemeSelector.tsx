import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme, type ThemeMode } from '../../hooks/useTheme';

interface ThemeSelectorProps {
  compact?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const themeModes: ThemeMode[] = ['light', 'dark', 'system'];

  const handleNextTheme = () => {
    const currentIndex = themeModes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeModes.length;
    setTheme(themeModes[nextIndex]);
  };

  const renderIcon = () => {
    if (theme === 'light') return <Sun className="size-4 text-amber-500 shrink-0" />;
    if (theme === 'dark') return <Moon className="size-4 text-indigo-400 shrink-0" />;
    return <Laptop className="size-4 text-[var(--ui-text-muted)] shrink-0" />;
  };

  const getThemeLabel = () => {
    if (theme === 'light') return t('settings.appearance.light');
    if (theme === 'dark') return t('settings.appearance.dark');
    return t('settings.appearance.system');
  };

  return (
    <button
      type="button"
      onClick={handleNextTheme}
      className="ui-button ui-button-secondary ui-icon-button size-9 inline-flex items-center justify-center transition-all shadow-xs"
      aria-label={t('accessibility.themeSelector')}
      title={`${getThemeLabel()} - ${t('common.theme')}`}
    >
      {renderIcon()}
    </button>
  );
};
