'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { upsertBudget, type BudgetState } from '@/lib/actions/budget';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil } from 'lucide-react';

const CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB'];

interface Budget {
  id: string;
  category: string;
  amount: number;
  currency: string;
}

interface Props {
  month: number;
  year: number;
  categories: string[];
  budget?: Budget;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Saqlash
    </Button>
  );
}

export function BudgetDialog({ month, year, categories, budget }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<BudgetState, FormData>(upsertBudget, null);

  const isEdit = !!budget;

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        isEdit
          ? <Button variant="ghost" size="icon" className="h-7 w-7" />
          : <Button size="sm"><Plus className="mr-1 h-4 w-4" />Byudjet qo&apos;shish</Button>
      }>
        {isEdit && <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Byudjetni tahrirlash' : 'Yangi byudjet'}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="year" value={year} />

          {state?.error && (
            <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="category">Kategoriya</Label>
            <input
              id="category"
              name="category"
              list="cat-list"
              defaultValue={budget?.category ?? ''}
              readOnly={isEdit}
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            />
            <datalist id="cat-list">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Limit miqdori</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min="0"
              step="1000"
              defaultValue={budget?.amount ?? ''}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Valyuta</Label>
            <select
              id="currency"
              name="currency"
              defaultValue={budget?.currency ?? 'UZS'}
              disabled={isEdit}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {isEdit && <input type="hidden" name="currency" value={budget.currency} />}
          </div>

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
