'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { updateRecurring, type TransactionState } from '@/lib/actions/transaction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SELECT_CLS } from '@/components/transactions/transaction-dialog';
import { EXPENSE_DEFAULTS, INCOME_DEFAULTS } from '@/lib/category-icons';
import { FREQUENCIES, type Frequency } from '@/lib/recurring';
import { toDateInput } from '@/lib/form-date';
import { Loader2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { categoryName } from '@/lib/category-icons';

export type EditableRecurring = {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  walletId: string;
  amount: number;
  category: string | null;
  description: string | null;
  frequency: Frequency;
  nextDate: string; // "YYYY-MM-DD" (O'zbekiston vaqti)
};

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

export function RecurringDialog({
  rule,
  wallets,
  savedCategories,
}: {
  rule: EditableRecurring;
  wallets: { id: string; name: string; currency: string }[];
  savedCategories: { name: string }[];
}) {
  const t = useTranslations('transactions');
  const tc = useTranslations('common');
  const tCat = useTranslations('defaultCategories');
  const [open, setOpen] = useState(false);
  const [walletId, setWalletId] = useState(rule.walletId);
  const [state, action] = useFormState<TransactionState, FormData>(updateRecurring, null);

  const wallet = wallets.find(w => w.id === walletId);
  const today = toDateInput(new Date());
  const categories = Array.from(new Set([
    ...(rule.type === 'INCOME' ? INCOME_DEFAULTS : EXPENSE_DEFAULTS),
    ...savedCategories.map(c => c.name),
    ...(rule.category ? [rule.category] : []),
  ]));

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  function handleOpenChange(next: boolean) {
    if (next) setWalletId(rule.walletId);
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" />}>
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rule.type === 'INCOME' ? t('recurringIncome') : t('recurringExpense')}</DialogTitle>
          <DialogDescription>
            {t('recurringEditHint')}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={rule.id} />
          <input type="hidden" name="today" value={today} />
          <input type="hidden" name="walletId" value={walletId} />

          {state?.error && (
            <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="rec-wallet">{t('wallet')}</Label>
            <select id="rec-wallet" value={walletId} onChange={(e) => setWalletId(e.target.value)} className={SELECT_CLS}>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rec-amount">{t('amount')}{wallet ? ` (${wallet.currency})` : ''}</Label>
              <Input
                id="rec-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={rule.amount}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-category">{t('category')}</Label>
              <select id="rec-category" name="category" defaultValue={rule.category ?? ''} className={SELECT_CLS}>
                <option value="">{tc('select')}</option>
                {categories.map((c) => <option key={c} value={c}>{categoryName(c, tCat)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rec-frequency">{t('frequency')}</Label>
              <select id="rec-frequency" name="frequency" defaultValue={rule.frequency} className={SELECT_CLS}>
                {FREQUENCIES.map((f) => <option key={f} value={f}>{t(`freq.${f}`)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-next">{t('nextDate')}</Label>
              <Input id="rec-next" name="nextDate" type="date" min={today} defaultValue={rule.nextDate} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec-desc">{t('note')}</Label>
            <Input id="rec-desc" name="description" placeholder={t('notePlaceholder')} defaultValue={rule.description ?? ''} />
          </div>

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
