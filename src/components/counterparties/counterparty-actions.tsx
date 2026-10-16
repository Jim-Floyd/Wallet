'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GitMerge, Loader2, Pencil } from 'lucide-react';
import { mergeCounterparty, updateCounterparty, type CounterpartyState } from '@/lib/actions/counterparty';
import type { CounterpartyOption } from '@/lib/counterparty';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SELECT_CLS } from '@/components/transactions/transaction-dialog';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}

// Odamni tahrirlash: ism (barcha qarzlarida ham yangilanadi), telefon, izoh
export function EditCounterpartyDialog({ counterparty }: { counterparty: CounterpartyOption & { note: string | null } }) {
  const t = useTranslations('counterparties');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<CounterpartyState, FormData>(updateCounterparty, null);
  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t('editTitle')} />}>
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
          <DialogDescription>{t('editHint')}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={counterparty.id} />
          {state?.error && <Alert variant="destructive" className="py-2 text-sm">{state.error}</Alert>}
          <div className="space-y-2">
            <Label htmlFor={`cp-name-${counterparty.id}`}>{t('name')}</Label>
            <Input id={`cp-name-${counterparty.id}`} name="name" defaultValue={counterparty.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`cp-phone-${counterparty.id}`}>{t('phone')}</Label>
            <Input id={`cp-phone-${counterparty.id}`} name="phone" type="tel" placeholder="+998..." defaultValue={counterparty.phone ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`cp-note-${counterparty.id}`}>{t('note')}</Label>
            <Input id={`cp-note-${counterparty.id}`} name="note" defaultValue={counterparty.note ?? ''} />
          </div>
          <SubmitButton label={tc('save')} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Birlashtirish: shu odamning barcha qarzlari tanlangan odamga o'tadi, bu yozuv o'chadi
// (bir odam ikki xil yozilib qolganda: "Али ака" → "Ali aka")
export function MergeCounterpartyDialog({
  counterparty, others,
}: { counterparty: CounterpartyOption; others: CounterpartyOption[] }) {
  const t = useTranslations('counterparties');
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<CounterpartyState, FormData>(mergeCounterparty, null);
  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);
  if (others.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t('mergeTitle', { name: counterparty.name })} />}>
        <GitMerge className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('mergeTitle', { name: counterparty.name })}</DialogTitle>
          <DialogDescription>{t('mergeHint', { name: counterparty.name })}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={counterparty.id} />
          {state?.error && <Alert variant="destructive" className="py-2 text-sm">{state.error}</Alert>}
          <div className="space-y-2">
            <Label htmlFor={`cp-merge-${counterparty.id}`}>{t('mergeInto')}</Label>
            <select id={`cp-merge-${counterparty.id}`} name="targetId" defaultValue="" required className={SELECT_CLS}>
              <option value="" disabled>{t('select')}</option>
              {[...others].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <SubmitButton label={t('merge')} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
