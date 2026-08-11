import { getUiLocale } from './languages';

export const formatUiDate = (value: string | number | Date, language?: string | null): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(getUiLocale(language), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

export const formatUiNumber = (value: number, language?: string | null): string =>
  new Intl.NumberFormat(getUiLocale(language)).format(value);
