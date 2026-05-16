'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { X } from 'lucide-react';

type Wallet = { id: string; name: string; currency: string };

const TYPES = [
  { value: '', label: 'Barchasi' },
  { value: 'EXPENSE', label: 'Xarajat' },
  { value: 'INCOME', label: 'Daromad' },
  { value: 'TRANSFER', label: "O'tkazma" },
];

export function TransactionFilters({ wallets }: { wallets: Wallet[] }) {
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
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => set('type', t.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              type === t.value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Hamyon */}
      <select
        value={walletId}
        onChange={(e) => set('walletId', e.target.value)}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Barcha hamyonlar</option>
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
          Tozalash
        </button>
      )}
    </div>
  );
}
