export type UiLanguageCode = 'vi' | 'en' | 'ja';

export const UI_LANGUAGE_STORAGE_KEY = 'lts_language';

export const UI_LANGUAGES = [
  { code: 'vi', locale: 'vi-VN', nativeName: 'Tiếng Việt', shortLabel: 'VI', flag: '🇻🇳' },
  { code: 'en', locale: 'en-US', nativeName: 'English', shortLabel: 'EN', flag: '🇺🇸' },
  { code: 'ja', locale: 'ja-JP', nativeName: '日本語', shortLabel: 'JA', flag: '🇯🇵' },
] as const satisfies readonly {
  code: UiLanguageCode;
  locale: 'vi-VN' | 'en-US' | 'ja-JP';
  nativeName: string;
  shortLabel: 'VI' | 'EN' | 'JA';
  flag: string;
}[];

export const normalizeUiLanguage = (value?: string | null): UiLanguageCode => {
  const normalized = value?.toLowerCase().split(/[-_]/)[0];
  return normalized === 'en' || normalized === 'ja' || normalized === 'vi' ? normalized : 'vi';
};

export const getUiLocale = (value?: string | null): 'vi-VN' | 'en-US' | 'ja-JP' => {
  const code = normalizeUiLanguage(value);
  return UI_LANGUAGES.find((language) => language.code === code)?.locale ?? 'vi-VN';
};
