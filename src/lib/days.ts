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

// Qarz muddati matni va ohangi: o'tgan — qizil, 3 kun ichida — sariq, qolgani — oddiy
export function dueInfo(due: Date, now = new Date()): { text: string; tone: 'overdue' | 'soon' | 'normal' } {
  const days = Math.round((dayStart(dayKey(due)).getTime() - dayStart(dayKey(now)).getTime()) / DAY_MS);
  if (days < 0) return { text: `Muddati o'tdi · ${-days} kun`, tone: 'overdue' };
  if (days === 0) return { text: 'Bugun', tone: 'soon' };
  if (days === 1) return { text: 'Ertaga', tone: 'soon' };
  if (days <= 7) return { text: `${days} kun qoldi`, tone: days <= 3 ? 'soon' : 'normal' };
  return {
    text: new Intl.DateTimeFormat('uz-UZ', { timeZone: APP_TZ, day: 'numeric', month: 'short' }).format(due),
    tone: 'normal',
  };
}

// "Bugun", "Kecha" yoki "22-sentabr, dushanba"
export function dayLabel(key: string, now = new Date()) {
  const today = dayKey(now);
  if (key === today) return 'Bugun';
  if (key === dayKey(new Date(now.getTime() - DAY_MS))) return 'Kecha';
  const date = dayStart(key);
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat('uz-UZ', {
    timeZone: APP_TZ,
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    ...(!sameYear && { year: 'numeric' }),
  }).format(date);
}
