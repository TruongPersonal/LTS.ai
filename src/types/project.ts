import type { TargetLanguageCode } from './database';

export interface LanguageOption {
  code: TargetLanguageCode;
  nativeName: string;
  flag: string;
}

export const TARGET_LANGUAGES: LanguageOption[] = [
  { code: 'vi', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', nativeName: 'English', flag: '🇺🇸' },
  { code: 'zh', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'fr', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'it', nativeName: 'Italiano', flag: '🇮🇹' },
];

export const NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
  de: 'Deutsch',
  ru: 'Русский',
  pt: 'Português',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
  vietnamese: 'Tiếng Việt',
  english: 'English',
  japanese: '日本語',
  korean: '한국어',
  chinese: '中文',
  french: 'Français',
  italian: 'Italiano',
  spanish: 'Español',
  german: 'Deutsch',
  russian: 'Русский',
  portuguese: 'Português',
  thai: 'ไทย',
  indonesian: 'Bahasa Indonesia',
};

export const getLanguageOption = (code: string): LanguageOption | undefined => {
  const c = code.toLowerCase().trim();
  return TARGET_LANGUAGES.find((lang) => lang.code === c);
};

export const getNativeLanguageName = (code: string | null | undefined): string => {
  if (!code) return 'English';
  const c = code.toLowerCase().trim();
  return NATIVE_LANGUAGE_NAMES[c] || code;
};
