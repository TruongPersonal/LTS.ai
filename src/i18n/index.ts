import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import vi from './locales/vi.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import { normalizeUiLanguage, UI_LANGUAGE_STORAGE_KEY } from './languages';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
      ja: { translation: ja },
    },
    supportedLngs: ['vi', 'en', 'ja'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'lts_language',
      caches: ['localStorage'],
    },
  });

const syncDocumentLanguage = (language?: string) => {
  if (typeof document === 'undefined') return;
  const code = normalizeUiLanguage(language);
  document.documentElement.lang = code;
  if (typeof window !== 'undefined') window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, code);
  const title = i18n.t('meta.title');
  if (title && title !== 'meta.title') document.title = title;
};

i18n.on('languageChanged', syncDocumentLanguage);
void i18n.loadNamespaces('translation').then(() => syncDocumentLanguage(i18n.resolvedLanguage || i18n.language));

export default i18n;
