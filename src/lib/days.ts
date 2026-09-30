import { intlLocale, type Translate } from '@/lib/intl';

// Kunlar O'zbekiston vaqti bo'yicha (UTC+5, yozgi vaqt yo'q) — server qaysi zonada bo'lmasin
export const APP_TZ = 'Asia/Tashkent';
const TZ_OFFSET = '+05:00';
const DAY_MS = 24 * 60 * 60 * 1000;

// Date → "YYYY-MM-DD"
export function dayKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ }).format(date);
}

export function dayStart(key: string) {
  return new Date(`${key}T00:00:00${TZ_OFFSET}`);
}

export function dayEnd(key: string) {
  return new Date(dayStart(key).getTime() + DAY_MS);
}

// Sana ilova vaqt zonasida, tanlangan til formatida
export function formatDay(date: Date, locale: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: APP_TZ, ...opts }).format(date);
}

// Qarz muddati matni va ohangi: o'tgan — qizil, 3 kun ichida — sariq, qolgani — oddiy.
// t — "days" nomlar fazosi
export function dueInfo(due: Date, t: Translate, locale: string, now = new Date()): { text: string; tone: 'overdue' | 'soon' | 'normal' } {
  const days = Math.round((dayStart(dayKey(due)).getTime() - dayStart(dayKey(now)).getTime()) / DAY_MS);
  if (days < 0) return { text: t('overdue', { days: -days }), tone: 'overdue' };
  if (days === 0) return { text: t('today'), tone: 'soon' };
  if (days === 1) return { text: t('tomorrow'), tone: 'soon' };
  if (days <= 7) return { text: t('daysLeft', { days }), tone: days <= 3 ? 'soon' : 'normal' };
  return { text: formatDay(due, locale, { day: 'numeric', month: 'short' }), tone: 'normal' };
}

// "Bugun", "Kecha" yoki "22-sentabr, dushanba". t — "days" nomlar fazosi
export function dayLabel(key: string, t: Translate, locale: string, now = new Date()) {
  const today = dayKey(now);
  if (key === today) return t('today');
  if (key === dayKey(new Date(now.getTime() - DAY_MS))) return t('yesterday');
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return formatDay(dayStart(key), locale, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    ...(!sameYear && { year: 'numeric' }),
  });
}
