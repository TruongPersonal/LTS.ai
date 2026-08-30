import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import { UI_LANGUAGES, UI_LANGUAGE_STORAGE_KEY, normalizeUiLanguage, type UiLanguageCode } from '../../i18n/languages';

interface LanguageSelectorProps {
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ compact = false }) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentCode = normalizeUiLanguage(i18n.resolvedLanguage || i18n.language);
  const currentLang = UI_LANGUAGES.find((lang) => lang.code === currentCode) || UI_LANGUAGES[0];

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectLanguage = (code: UiLanguageCode) => {
    void i18n.changeLanguage(code);
    try {
      localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, code);
    } catch {
      
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`ui-button ui-button-secondary inline-flex items-center justify-between gap-1.5 font-bold transition-all shadow-xs border border-[var(--ui-border)] hover:border-[var(--ui-accent)] rounded-xl ${
          compact ? 'px-2.5 h-8 text-[11px]' : 'px-3 h-9 text-xs'
        }`}
        aria-label={t('accessibility.languageSelector')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5">
          <span className="text-sm leading-none">{currentLang.flag}</span>
          <span>{currentLang.shortLabel}</span>
        </span>
        <ChevronDown
          className={`size-3.5 text-[var(--ui-muted)] transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--ui-accent)]' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[var(--ui-surface)] border border-[var(--ui-border)] p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
        >
          {UI_LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentCode;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelectLanguage(lang.code)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]'
                    : 'text-[var(--ui-text)] hover:bg-[var(--ui-surface-subtle)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{lang.flag}</span>
                  <span className="font-semibold">{lang.nativeName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] ui-muted font-mono">{lang.shortLabel}</span>
                  {isSelected && <Check className="size-3.5 text-[var(--ui-accent)]" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
