'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

const SELECT_CLS = 'rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring';

// Oy tanlash: ‹ › — qo'shni oy, o'rtada oy va yil ro'yxatlari. Qiymat URL dagi ?month=&year= da (Budget, PNL, Bosh sahifa)
export function MonthNav({ month, year }: { month: number; year: number }) {
  const t = useTranslations('months');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = (m: number, y: number) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('month', String(m));
    p.set('year', String(y));
    router.push(`${pathname}?${p}`);
  };

  const prev = () => month === 1 ? navigate(12, year - 1) : navigate(month - 1, year);
  const next = () => month === 12 ? navigate(1, year + 1) : navigate(month + 1, year);

  // Oy nomlari tarjimadan: brauzerlarda o'zbekcha oy nomlari yo'q — Intl "M09" qaytaradi
  const monthNames = Array.from({ length: 12 }, (_, i) => t(`m${i + 1}`));
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: Math.max(year, currentYear) + 1 - (Math.min(year, currentYear) - 5) + 1 },
    (_, i) => Math.min(year, currentYear) - 5 + i,
  );

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={prev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <select
        aria-label="month"
        value={month}
        onChange={(e) => navigate(Number(e.target.value), year)}
        className={SELECT_CLS}
      >
        {monthNames.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
      </select>
      <select
        aria-label="year"
        value={year}
        onChange={(e) => navigate(month, Number(e.target.value))}
        className={SELECT_CLS}
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={next}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
