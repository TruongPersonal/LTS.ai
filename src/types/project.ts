import type { TargetLanguageCode } from './database';

export interface LanguageOption {
  code: TargetLanguageCode;
  nativeName: string;
  nameVi: string;
  nameEn: string;
  flag: string;
}

export const TARGET_LANGUAGES: LanguageOption[] = [
  { code: 'vi', nativeName: 'Tiếng Việt', nameVi: 'Tiếng Việt', nameEn: 'Vietnamese', flag: '🇻🇳' },
  { code: 'en', nativeName: 'English', nameVi: 'Tiếng Anh', nameEn: 'English', flag: '🇺🇸' },
  { code: 'zh', nativeName: '中文', nameVi: 'Tiếng Trung', nameEn: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', nativeName: '日本語', nameVi: 'Tiếng Nhật', nameEn: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', nativeName: '한국어', nameVi: 'Tiếng Hàn', nameEn: 'Korean', flag: '🇰🇷' },
  { code: 'fr', nativeName: 'Français', nameVi: 'Tiếng Pháp', nameEn: 'French', flag: '🇫🇷' },
  { code: 'it', nativeName: 'Italiano', nameVi: 'Tiếng Ý', nameEn: 'Italian', flag: '🇮🇹' },
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
};

export const getLanguageOption = (code: string): LanguageOption | undefined => {
  return TARGET_LANGUAGES.find((lang) => lang.code === code.toLowerCase().trim());
};

export const getNativeLanguageName = (code: string | null | undefined): string => {
  if (!code) return 'English';
  const c = code.toLowerCase().trim();
  return NATIVE_LANGUAGE_NAMES[c] || code;
};

export const getLanguageName = (code: string | null | undefined, locale: string = 'vi'): string => {
  if (!code) return locale.startsWith('vi') ? 'Tiếng Anh' : 'English';
  const c = code.toLowerCase().trim();
  const opt = getLanguageOption(c);
  if (opt) {
    return locale.startsWith('vi') ? opt.nameVi : opt.nameEn;
  }
  const extraLangsVi: Record<string, string> = {
    es: 'Tiếng Tây Ban Nha',
    de: 'Tiếng Đức',
    ru: 'Tiếng Nga',
    pt: 'Tiếng Bồ Đào Nha',
    th: 'Tiếng Thái',
    id: 'Tiếng Indonesia',
  };
  const extraLangsEn: Record<string, string> = {
    es: 'Spanish',
    de: 'German',
    ru: 'Russian',
    pt: 'Portuguese',
    th: 'Thai',
    id: 'Indonesian',
  };
  if (locale.startsWith('vi') && extraLangsVi[c]) return extraLangsVi[c];
  if (!locale.startsWith('vi') && extraLangsEn[c]) return extraLangsEn[c];
  return code;
};
