import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { UI_LANGUAGES, UI_LANGUAGE_STORAGE_KEY, normalizeUiLanguage } from '../../i18n/languages';

interface LanguageSelectorProps {
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = () => {
  const { t, i18n } = useTranslation();
  const currentCode = normalizeUiLanguage(i18n.resolvedLanguage || i18n.language);
  const currentLang = UI_LANGUAGES.find((lang) => lang.code === currentCode) || UI_LANGUAGES[0];

  const handleNextLanguage = () => {
    const currentIndex = UI_LANGUAGES.findIndex((lang) => lang.code === currentCode);
    const nextIndex = (currentIndex + 1) % UI_LANGUAGES.length;
    const nextCode = UI_LANGUAGES[nextIndex].code;
    void i18n.changeLanguage(nextCode);
    try {
      localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, nextCode);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleNextLanguage}
      className="ui-button ui-button-secondary inline-flex items-center gap-1.5 px-3 h-9 text-xs font-bold transition-all shadow-xs"
      aria-label={t('accessibility.languageSelector')}
      title={`${currentLang.nativeName} (${currentLang.shortLabel})`}
    >
      <Languages className="size-4 text-[var(--ui-accent)] shrink-0" />
      <span>{currentLang.shortLabel}</span>
    </button>
  );
};
