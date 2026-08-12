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

export const getLanguageOption = (code: string): LanguageOption | undefined => {
  return TARGET_LANGUAGES.find((lang) => lang.code === code);
};
