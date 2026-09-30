'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { addDebtPayment, type DebtState } from '@/lib/actions/debt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SELECT_CLS } from '@/components/transactions/transaction-dialog';
import { toDateInput } from '@/lib/form-date';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { formatMoney } from '@/lib/intl';

type Wallet = { id: string; name: string; currency: string };

function SubmitButton() {
  const t = useTranslations('common');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {t('save')}
    </Button>
  );
}

export function DebtPaymentDialog({
  debt,
  wallets,
}: {
  debt: { id: string; type: 'LENT' | 'BORROWED'; person: string; currency: string; remaining: number };
  wallets: Wallet[];
}) {
  const t = useTranslations('debts');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<DebtState, FormData>(addDebtPayment, null);

  // Qaytarish faqat qarz valyutasidagi hamyon orqali
  const matching = wallets.filter(w => w.currency === debt.currency);
  const today = toDateInput(new Date());
  const isLent = debt.type === 'LENT';

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="h-7 text-xs" />}>
        {isLent ? t('markRepaid') : t('pay')}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isLent ? t('repaidTitle', { person: debt.person }) : t('payTitle', { person: debt.person })}</DialogTitle>
          <DialogDescription>
            {t('remainingDebt', { amount: formatMoney(debt.remaining, debt.currency, locale) })}
          </DialogDescription>
        </DialogHeader>

        {matching.length === 0 ? (
          <Alert className="text-sm py-2">
            {t('noMatchingWallet', { currency: debt.currency })}
          </Alert>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="debtId" value={debt.id} />
            <input type="hidden" name="today" value={today} />

            {state?.error && (
              <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="pay-wallet">{isLent ? t('walletRepaid') : t('walletPaid')}</Label>
              <select id="pay-wallet" name="walletId" defaultValue={matching[0].id} className={SELECT_CLS}>
                {matching.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pay-amount">{t('amount')} ({debt.currency})</Label>
                <Input
                  id="pay-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  max={debt.remaining}
                  step="0.01"
                  defaultValue={debt.remaining}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-date">{t('date')}</Label>
                <Input id="pay-date" name="date" type="date" max={today} defaultValue={today} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay-desc">{t('note')}</Label>
              <Input id="pay-desc" name="description" placeholder={t('notePlaceholder')} />
            </div>

            <SubmitButton />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
