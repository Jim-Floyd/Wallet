'use client';

import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { AmountInput } from '@/components/amount-input';
import type { WalletKindValue } from '@/lib/credit';

// Hamyon turi (debet/kredit) va kredit limiti — qo'shish va tahrirlash oynalarida umumiy
export function WalletKindFields({
  kind,
  currency,
  defaultLimit,
  onKindChange,
}: {
  kind: WalletKindValue;
  currency: string;
  defaultLimit?: number | null;
  onKindChange: (kind: WalletKindValue) => void;
}) {
  const t = useTranslations('wallets');
  return (
    <div className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <div className="space-y-2">
        <Label>{t('kind')}</Label>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(['DEBIT', 'CREDIT'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onKindChange(value)}
              className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                kind === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`kinds.${value}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t(`kindHints.${kind}`)}</p>
      </div>

      {kind === 'CREDIT' && (
        <div className="space-y-2">
          <Label htmlFor="wallet-credit-limit">{t('creditLimit', { currency })}</Label>
          <AmountInput id="wallet-credit-limit" name="creditLimit" placeholder="0" defaultValue={defaultLimit} required />
        </div>
      )}
    </div>
  );
}
