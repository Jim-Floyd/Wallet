'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus } from 'lucide-react';
import { createCounterparty } from '@/lib/actions/counterparty';
import type { CounterpartyOption } from '@/lib/counterparty';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SELECT_CLS } from '@/components/transactions/transaction-dialog';

// Yangi odam qo'shish (kategoriyalardagi "+" kabi): saqlangach ro'yxatga qo'shilib, darhol tanlanadi
function AddCounterpartyDialog({ onCreated }: { onCreated: (cp: CounterpartyOption) => void }) {
  const t = useTranslations('counterparties');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saving, startSaving] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation(); // tashqi qarz/tranzaksiya formasiga o'tib ketmasin
    if (!name.trim()) return;
    startSaving(async () => {
      const result = await createCounterparty(name, phone);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      onCreated(result);
      setOpen(false);
      setName('');
      setPhone('');
      setError('');
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label={t('add')} />}>
        <Plus className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('newTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && <Alert variant="destructive" className="py-2 text-sm">{error}</Alert>}
          <div className="space-y-2">
            <Label htmlFor="cp-new-name">{t('name')}</Label>
            <Input id="cp-new-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} disabled={saving} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-new-phone">{t('phone')}</Label>
            <Input id="cp-new-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998..." disabled={saving} />
          </div>
          <Button type="submit" className="w-full" disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tc('save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// "Kim bilan" — ro'yxatdan tanlash (yashirin counterpartyId bilan formaga yuboriladi) + yangi qo'shish.
// Ism qo'lda yozilmaydi — bir odam turli yozilishda (lotin/kirill) bir necha marta paydo bo'lmasin
export function CounterpartyPicker({
  options, defaultValue, label, id = 'counterparty',
}: { options: CounterpartyOption[]; defaultValue?: string | null; label: string; id?: string }) {
  const t = useTranslations('counterparties');
  const [list, setList] = useState(options);
  const [value, setValue] = useState(defaultValue ?? '');
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <input type="hidden" name="counterpartyId" value={value} />
      <div className="flex gap-2">
        <select id={id} value={value} onChange={(e) => setValue(e.target.value)} required className={`flex-1 ${SELECT_CLS}`}>
          <option value="" disabled>{t('select')}</option>
          {sorted.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
          ))}
        </select>
        <AddCounterpartyDialog
          onCreated={(cp) => {
            setList((prev) => [...prev, cp]);
            setValue(cp.id);
          }}
        />
      </div>
      {list.length === 0 && <p className="text-xs text-muted-foreground">{t('emptyHint')}</p>}
    </div>
  );
}
