'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { upsertBudget, type BudgetState } from '@/lib/actions/budget';
import { Button } from '@/components/ui/button';
import { AmountInput } from '@/components/amount-input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { categoryName } from '@/lib/category-icons';

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
  const t = useTranslations('common');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {t('save')}
    </Button>
  );
}

export function BudgetDialog({ month, year, categories, budget }: Props) {
  const t = useTranslations('budget');
  const tCat = useTranslations('defaultCategories');
  const tc = useTranslations('common');
  const tm = useTranslations('months');
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<BudgetState, FormData>(upsertBudget, null);
  // Davr: standart — sahifada ochiq oy; tahrirlashda o'zgarmaydi
  const [periodMonth, setPeriodMonth] = useState(month);
  const [periodYear, setPeriodYear] = useState(year);
  const [span, setSpan] = useState(1);

  const isEdit = !!budget;
  const thisYear = new Date().getFullYear();
  const years = Array.from(new Set([year, thisYear - 1, thisYear, thisYear + 1, thisYear + 2])).sort();
  const lastIndex = periodMonth - 1 + span - 1;
  const periodLabel = (m: number, y: number) => `${tm(`m${m}`)} ${y}`;
  const spanRange = span > 1
    ? { from: periodLabel(periodMonth, periodYear), to: periodLabel((lastIndex % 12) + 1, periodYear + Math.floor(lastIndex / 12)) }
    : null;

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  function handleOpenChange(next: boolean) {
    if (next) {
      setPeriodMonth(month);
      setPeriodYear(year);
      setSpan(1);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={
        isEdit
          ? <Button variant="ghost" size="icon" className="h-7 w-7" />
          : <Button size="sm"><Plus className="mr-1 h-4 w-4" />{t('add')}</Button>
      }>
        {isEdit && <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editTitle') : t('newTitle')}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="month" value={periodMonth} />
          <input type="hidden" name="year" value={periodYear} />
          <input type="hidden" name="span" value={isEdit ? 1 : span} />

          {state?.error && (
            <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>
          )}

          {/* Davr: qaysi oydan va necha oyga */}
          <div className="space-y-2">
            <Label htmlFor="budget-month">{t('period')}</Label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select
                id="budget-month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(Number(e.target.value))}
                disabled={isEdit}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{tm(`m${m}`)}</option>
                ))}
              </select>
              <select
                aria-label={t('period')}
                value={periodYear}
                onChange={(e) => setPeriodYear(Number(e.target.value))}
                disabled={isEdit}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="budget-span">{t('span')}</Label>
              <select
                id="budget-span"
                value={span}
                onChange={(e) => setSpan(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {[1, 3, 6, 12].map((n) => <option key={n} value={n}>{t('spanOption', { count: n })}</option>)}
              </select>
              {spanRange && <p className="text-xs text-muted-foreground">{t('spanHint', spanRange)}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="category">{t('category')}</Label>
            {/* Ro'yxatdan tanlanadi — nom tranzaksiyalardagi kategoriya bilan aynan mos bo'lishi uchun */}
            <select
              id="category"
              name={isEdit ? undefined : 'category'}
              defaultValue={budget?.category ?? ''}
              disabled={isEdit}
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="" disabled>{tc('select')}</option>
              {(budget && !categories.includes(budget.category) ? [budget.category, ...categories] : categories).map((c) => (
                <option key={c} value={c}>{categoryName(c, tCat)}</option>
              ))}
            </select>
            {isEdit && <input type="hidden" name="category" value={budget.category} />}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">{t('limitAmount')}</Label>
            <AmountInput
              id="amount"
              name="amount"
              defaultValue={budget?.amount}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">{t('currency')}</Label>
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
