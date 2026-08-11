import React from 'react';
import { useTranslation } from 'react-i18next';
import { UI_LANGUAGES, normalizeUiLanguage } from '../../i18n/languages';

interface LanguageSelectorProps {
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ compact = false }) => {
  const { t, i18n } = useTranslation();
  const currentCode = normalizeUiLanguage(i18n.resolvedLanguage || i18n.language);

  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{t('accessibility.languageSelector')}</span>
      <select
        value={currentCode}
        onChange={(event) => void i18n.changeLanguage(event.target.value)}
        className={`ui-select ${compact ? 'ui-select-compact text-[11px] font-bold' : 'text-xs font-semibold'}`}
        aria-label={t('accessibility.languageSelector')}
      >
        {UI_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {compact ? language.shortLabel : `${language.flag} ${language.nativeName}`}
          </option>
        ))}
      </select>
    </label>
  );
};
