import { dayKey, dayStart } from '@/lib/days';

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'DAILY', label: 'Har kuni' },
  { value: 'WEEKLY', label: 'Har hafta' },
  { value: 'MONTHLY', label: 'Har oy' },
  { value: 'YEARLY', label: 'Har yili' },
];

export const frequencyLabel = (f: string) => FREQUENCIES.find(x => x.value === f)?.label ?? f;

export const isFrequency = (v: unknown): v is Frequency => FREQUENCIES.some(f => f.value === v);

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12

// n-takror sanasi (0 — birinchisi), O'zbekiston kalendari bo'yicha kun boshida.
// Har doim start dan hisoblanadi: 31-yanvardan boshlangan oylik takror → 28-fev → 31-mart.
export function occurrenceDate(start: Date, frequency: Frequency, n: number): Date {
  const [y, m, d] = dayKey(start).split('-').map(Number);

  if (frequency === 'DAILY' || frequency === 'WEEKLY') {
    const days = frequency === 'DAILY' ? n : n * 7;
    const utc = new Date(Date.UTC(y, m - 1, d + days));
    return dayStart(`${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`);
  }

  const totalMonths = (m - 1) + (frequency === 'MONTHLY' ? n : n * 12);
  const year = y + Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  const day = Math.min(d, daysInMonth(year, month));
  return dayStart(`${year}-${pad(month)}-${pad(day)}`);
}
