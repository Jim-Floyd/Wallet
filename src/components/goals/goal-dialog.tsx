'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { addGoal, updateGoal, type GoalState } from '@/lib/actions/goal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/components/amount-input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SELECT_CLS } from '@/components/transactions/transaction-dialog';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

const CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB'];

export type EditableGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline: string | null; // "YYYY-MM-DD"
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

// Maqsad qo'shish / tahrirlash (goal prop bo'lsa). Valyuta faqat qo'shishda tanlanadi
export function GoalDialog({ goal }: { goal?: EditableGoal }) {
  const t = useTranslations('goals');
  const isEdit = !!goal;
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState(goal?.currency ?? 'UZS');
  const [state, action] = useFormState<GoalState, FormData>(isEdit ? updateGoal : addGoal, null);

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit
            ? <Button variant="ghost" size="icon" className="h-7 w-7" />
            : <Button size="sm"><Plus className="mr-1 h-4 w-4" />{t('addGoal')}</Button>
        }
      >
        {isEdit && <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editTitle') : t('newTitle')}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={goal.id} />}
          {!isEdit && <input type="hidden" name="currency" value={currency} />}

          {state?.error && <Alert variant="destructive" className="py-2 text-sm">{state.error}</Alert>}

          <div className="space-y-2">
            <Label htmlFor="goal-name">{t('name')}</Label>
            <Input id="goal-name" name="name" placeholder={t('namePlaceholder')} defaultValue={goal?.name} required />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-target">{t('targetAmount')}</Label>
              <AmountInput id="goal-target" name="targetAmount" placeholder="0" defaultValue={goal?.targetAmount} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-currency">{t('currency')}</Label>
              <select
                id="goal-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isEdit}
                className={SELECT_CLS}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-current">{t('currentAmount')}</Label>
            <AmountInput id="goal-current" name="currentAmount" placeholder="0" defaultValue={goal?.currentAmount} />
            <p className="text-xs text-muted-foreground">{t('currentHint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-deadline">{t('deadline')}</Label>
            <Input id="goal-deadline" name="deadline" type="date" defaultValue={goal?.deadline ?? ''} />
            <p className="text-xs text-muted-foreground">{t('deadlineHint')}</p>
          </div>

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
