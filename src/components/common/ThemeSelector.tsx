import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeMode } from '../../context/ThemeContext';

interface ThemeSelectorProps {
  compact?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ compact = false }) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const options: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: t('settings.appearance.light') },
    { value: 'dark', label: t('settings.appearance.dark') },
    { value: 'system', label: t('settings.appearance.system') },
  ];

  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{t('accessibility.themeSelector')}</span>
      <select
        value={theme}
        onChange={(event) => setTheme(event.target.value as ThemeMode)}
        className={`ui-select ${compact ? 'ui-select-compact text-[11px] font-bold' : 'text-xs font-semibold'}`}
        aria-label={t('accessibility.themeSelector')}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
};
