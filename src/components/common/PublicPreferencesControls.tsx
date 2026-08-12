import React from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from './LanguageSelector';
import { ThemeSelector } from './ThemeSelector';

export const PublicPreferencesControls: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2" aria-label={t('common.settings')}>
      <LanguageSelector compact />
      <ThemeSelector compact />
    </div>
  );
};
