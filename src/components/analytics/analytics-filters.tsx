'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ANALYTICS_PERIODS } from '@/lib/analytics';

// Tahlil filtrlari: davr (oxirgi N oy, joriy oy bilan) va valyuta. URL'da saqlanadi — sahifadagi hamma narsa shu kesim bo'yicha
export function AnalyticsFilters({ period, currency, currencies }: { period: number; currency: string; currencies: string[] }) {
  const t = useTranslations('analytics');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label={t('periodLabel')}>
        {ANALYTICS_PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => set('period', String(p))}
            aria-pressed={period === p}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(`periods.m${p}`)}
          </button>
        ))}
      </div>
      {currencies.length > 1 && (
        <select
          value={currency}
          onChange={(e) => set('currency', e.target.value)}
          aria-label={t('currencyLabel')}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>
  );
}
