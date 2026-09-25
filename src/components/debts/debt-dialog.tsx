'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { addDebt, updateDebt, type DebtState } from '@/lib/actions/debt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SELECT_CLS } from '@/components/transactions/transaction-dialog';
import { toDateInput } from '@/lib/form-date';
import { Loader2, Pencil, Plus } from 'lucide-react';

const CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB'];

type DebtType = 'LENT' | 'BORROWED';
type Wallet = { id: string; name: string; currency: string };

export type EditableDebt = {
  id: string;
  type: DebtType;
  person: string;
  phone: string | null;
  currency: string;
  walletId: string | null; // boshlang'ich yozuv hamyoni; null — hamyonsiz
  dueDate: string | null; // ISO
  description: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Saqlash
    </Button>
  );
}

export function DebtDialog({ wallets, debt }: { wallets: Wallet[]; debt?: EditableDebt }) {
  const isEdit = !!debt;
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DebtType>('LENT');
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? '');
  const [currency, setCurrency] = useState('UZS');
  const [state, action] = useFormState<DebtState, FormData>(isEdit ? updateDebt : addDebt, null);

  const wallet = wallets.find(w => w.id === walletId);
  const today = toDateInput(new Date());

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  function handleOpenChange(next: boolean) {
    if (next && !isEdit) {
      setType('LENT');
      setWalletId(wallets[0]?.id ?? '');
      setCurrency('UZS');
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          isEdit
            ? <Button variant="ghost" size="icon" className="h-7 w-7" />
            : <Button size="sm"><Plus className="mr-1 h-4 w-4" />Qarz qo&apos;shish</Button>
        }
      >
        {isEdit && <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Qarzni tahrirlash' : 'Yangi qarz'}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {isEdit ? (
            <input type="hidden" name="id" value={debt.id} />
          ) : (
            <>
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="today" value={today} />
              <input type="hidden" name="walletId" value={walletId} />
              {!walletId && <input type="hidden" name="currency" value={currency} />}
            </>
          )}

          {state?.error && (
            <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>
          )}

          {!isEdit && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(['LENT', 'BORROWED'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                    type === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'LENT' ? 'Qarz berdim' : 'Qarz oldim'}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="debt-person">
                {isEdit
                  ? 'Kim bilan'
                  : type === 'LENT' ? 'Kimga' : 'Kimdan'}
              </Label>
              <Input id="debt-person" name="person" placeholder="Ism" defaultValue={debt?.person} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-phone">Telefon (ixtiyoriy)</Label>
              <Input id="debt-phone" name="phone" type="tel" placeholder="+998..." defaultValue={debt?.phone ?? ''} />
            </div>
          </div>

          {isEdit && (
            <div className="space-y-2">
              <Label htmlFor="debt-edit-wallet">
                {debt.type === 'LENT' ? 'Qaysi hamyondan berildi' : 'Qaysi hamyonga olindi'}
              </Label>
              <select
                id="debt-edit-wallet"
                name="walletId"
                defaultValue={debt.walletId ?? ''}
                className={SELECT_CLS}
              >
                {wallets.filter(w => w.currency === debt.currency).map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>
                ))}
                <option value="">— Hamyonsiz (balansga ta&apos;sir qilmaydi) —</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Faqat {debt.currency} hamyonlari. O&apos;zgartirilsa, hamyon balanslari avtomatik to&apos;g&apos;rilanadi.
              </p>
            </div>
          )}

          {!isEdit && (
            <>
              <div className="space-y-2">
                <Label htmlFor="debt-wallet">
                  {type === 'LENT' ? 'Qaysi hamyondan berildi' : 'Qaysi hamyonga olindi'}
                </Label>
                <select
                  id="debt-wallet"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className={SELECT_CLS}
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>
                  ))}
                  <option value="">— Hamyonsiz (balansga ta&apos;sir qilmaydi) —</option>
                </select>
                {!walletId && (
                  <p className="text-xs text-muted-foreground">
                    Oldindan mavjud qarzni yozib qo&apos;yish uchun. Hamyon balansi o&apos;zgarmaydi.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="debt-amount">Miqdor{wallet ? ` (${wallet.currency})` : ''}</Label>
                  <Input id="debt-amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0" required />
                </div>
                {walletId ? (
                  <div className="space-y-2">
                    <Label htmlFor="debt-date">Sana</Label>
                    <Input id="debt-date" name="date" type="date" max={today} defaultValue={today} required />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="debt-currency">Valyuta</Label>
                    <select
                      id="debt-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className={SELECT_CLS}
                    >
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {!walletId && (
                <div className="space-y-2">
                  <Label htmlFor="debt-date">Sana</Label>
                  <Input id="debt-date" name="date" type="date" max={today} defaultValue={today} required />
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="debt-due">Qaytarish muddati (ixtiyoriy)</Label>
            <Input
              id="debt-due"
              name="dueDate"
              type="date"
              defaultValue={debt?.dueDate ? toDateInput(new Date(debt.dueDate)) : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="debt-desc">Izoh (ixtiyoriy)</Label>
            <Input id="debt-desc" name="description" placeholder="Qo'shimcha ma'lumot..." defaultValue={debt?.description ?? ''} />
          </div>

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
