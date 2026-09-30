// Ilova tili → Intl formatlash locale'i (raqam, sana, oy nomlari)
const INTL_LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

export const intlLocale = (locale: string) => INTL_LOCALES[locale] ?? 'uz-UZ';

// Summani mutlaq qiymatda formatlaydi; ishorani chaqiruvchi qo'yadi
export function formatMoney(amount: number, currency: string, locale: string) {
  return `${new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(Math.abs(amount))} ${currency}`;
}

// next-intl tarjima funksiyasining sof lib'larga uzatiladigan soddalashtirilgan turi
export type Translate = (key: string, values?: Record<string, string | number>) => string;
