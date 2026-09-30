'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Wallet = { id: string; name: string; currency: string };

// Nomlari tarjimada: transactions.filter.<value || all>
const TYPES = ['', 'EXPENSE', 'INCOME', 'TRANSFER', 'DEBT'];

export function TransactionFilters({ wallets }: { wallets: Wallet[] }) {
  const t = useTranslations('transactions');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const type = searchParams.get('type') ?? '';
  const walletId = searchParams.get('walletId') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  const hasFilters = type || walletId || from || to;

  const set = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const clear = () => router.push(pathname);

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Tur */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {TYPES.map((value) => (
          <button
            key={value}
            onClick={() => set('type', value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              type === value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(`filter.${value || 'all'}`)}
          </button>
        ))}
      </div>

      {/* Hamyon */}
      <select
        value={walletId}
        onChange={(e) => set('walletId', e.target.value)}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{t('allWallets')}</option>
        {wallets.map((w) => (
          <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>
        ))}
      </select>

      {/* Sana */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={from}
          onChange={(e) => set('from', e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => set('to', e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Tozalash */}
      {hasFilters && (
        <button
          onClick={clear}
          className="flex h-9 items-center gap-1 rounded-lg border border-input px-3 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          {t('clearFilters')}
        </button>
      )}
    </div>
  );
}
