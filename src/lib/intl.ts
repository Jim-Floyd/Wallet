// Ilova tili → Intl formatlash locale'i (raqam, sana, oy nomlari)
const INTL_LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

export const intlLocale = (locale: string) => INTL_LOCALES[locale] ?? 'uz-UZ';

// Summani mutlaq qiymatda formatlaydi; ishorani chaqiruvchi qo'yadi
export function formatMoney(amount: number, currency: string, locale: string) {
  return `${new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(Math.abs(amount))} ${currency}`;
}

// Qoldiq kabi ishorasi o'zi ma'noga ega summa: manfiy bo'lsa "-" bilan (masalan kredit karta qarzi)
export function formatMoneySigned(amount: number, currency: string, locale: string) {
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded < 0 ? '-' : ''}${formatMoney(rounded, currency, locale)}`;
}

// Grafik o'qlari uchun ixcham son: "1,5 mln", "250 ming". Brauzer ICU'sida o'zbekcha qisqartmalar yo'q — o'zimiz
const COMPACT_UNITS: Record<string, [number, string][]> = {
  uz: [[1e9, ' mlrd'], [1e6, ' mln'], [1e3, ' ming']],
  ru: [[1e9, ' млрд'], [1e6, ' млн'], [1e3, ' тыс']],
  en: [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']],
};

export function formatCompact(n: number, locale: string) {
  const units = COMPACT_UNITS[locale] ?? COMPACT_UNITS.uz;
  const fmt = (v: number) => new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 }).format(v);
  for (const [value, suffix] of units) {
    if (Math.abs(n) >= value) return `${fmt(n / value)}${suffix}`;
  }
  return fmt(n);
}

// next-intl tarjima funksiyasining sof lib'larga uzatiladigan soddalashtirilgan turi
export type Translate = (key: string, values?: Record<string, string | number>) => string;
