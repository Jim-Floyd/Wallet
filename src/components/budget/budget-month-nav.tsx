'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from 'next-intl';
import { intlLocale } from '@/lib/intl';

interface Props { month: number; year: number }

export function BudgetMonthNav({ month, year }: Props) {
  const locale = useLocale();
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

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={prev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-32 text-center font-semibold">
        {new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))}
      </span>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={next}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
