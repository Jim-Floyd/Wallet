// Tahlil davrlari (oxirgi N oy, joriy oy bilan). Server sahifa ham, client filtr ham ishlatadi —
// shuning uchun 'use client' faylda emas: u yerdan import qilingan qiymat serverda faqat havola bo'lib qoladi
export const ANALYTICS_PERIODS = [1, 3, 6, 12] as const;
export const DEFAULT_PERIOD = 6;

export function parsePeriod(value: string | undefined) {
  const n = Number(value);
  return (ANALYTICS_PERIODS as readonly number[]).includes(n) ? n : DEFAULT_PERIOD;
}
