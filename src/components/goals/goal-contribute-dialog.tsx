'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { contributeGoal, type GoalState } from '@/lib/actions/goal';
import { Button } from '@/components/ui/button';
import { AmountInput } from '@/components/amount-input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

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

// Maqsadga yig'ilgan summani qo'lda o'zgartirish: qo'shish yoki olish. Hamyon balanslariga ta'sir qilmaydi
export function GoalContributeDialog({
  goal,
}: {
  goal: { id: string; name: string; currency: string; remainingLabel: string; suggested: number | null };
}) {
  const t = useTranslations('goals');
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'add' | 'withdraw'>('add');
  const [state, action] = useFormState<GoalState, FormData>(contributeGoal, null);

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  function handleOpenChange(next: boolean) {
    if (next) setDirection('add');
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="h-7 text-xs" />}>
        {t('contribute')}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{goal.name}</DialogTitle>
          <DialogDescription>{goal.remainingLabel}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={goal.id} />
          <input type="hidden" name="direction" value={direction} />

          {state?.error && <Alert variant="destructive" className="py-2 text-sm">{state.error}</Alert>}

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(['add', 'withdraw'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDirection(value)}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                  direction === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {value === 'add' ? t('directionAdd') : t('directionWithdraw')}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-amount">{t('amount')} ({goal.currency})</Label>
            <AmountInput
              key={direction}
              id="goal-amount"
              name="amount"
              placeholder="0"
              defaultValue={direction === 'add' ? goal.suggested : null}
              required
            />
            <p className="text-xs text-muted-foreground">{t('contributeHint')}</p>
          </div>

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
