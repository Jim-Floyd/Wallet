import { useLocale, useTranslations } from 'next-intl';
import { formatMoney, formatMoneySigned } from '@/lib/intl';
import type { creditInfo } from '@/lib/credit';

// Kredit hamyon ostida: ishlatilgan / limit chizig'i va mavjud mablag' (limitdan oshsa qizil)
export function CreditUsage({ info, currency }: { info: NonNullable<ReturnType<typeof creditInfo>>; currency: string }) {
  const t = useTranslations('wallets');
  const locale = useLocale();
  const over = info.available < 0;
  return (
    <div className="mt-1.5 space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${over ? 'bg-red-500' : info.usedPct >= 80 ? 'bg-amber-400' : 'bg-blue-500'}`}
          style={{ width: `${info.usedPct}%` }}
        />
      </div>
      <p className={`text-xs tabular-nums ${over ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>
        {t('creditAvailable', {
          available: formatMoneySigned(info.available, currency, locale),
          limit: formatMoney(info.limit, currency, locale),
        })}
      </p>
    </div>
  );
}
