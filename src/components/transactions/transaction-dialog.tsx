'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { addTransaction, updateTransaction, type TransactionState } from '@/lib/actions/transaction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AddCategoryDialog } from '@/components/categories/add-category-dialog';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { toDateInput } from '@/lib/form-date';
import { APP_TZ, dayStart } from '@/lib/days';
import { FREQUENCIES, occurrenceDate, type Frequency } from '@/lib/recurring';
import { EXPENSE_DEFAULTS, INCOME_DEFAULTS, categoryIconKey, getCategoryIcon, iconBg } from '@/lib/category-icons';

const CURRENCY_RANK: Record<string, number> = { UZS: 1, RUB: 2, USD: 3, EUR: 4 };

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
type Wallet = { id: string; name: string; currency: string };
type Category = { id: string; name: string; icon: string | null };

export type EditableTransaction = {
  id: string;
  type: TxType;
  walletId: string;
  toWalletId: string | null;
  amount: number;
  rate: number | null;
  category: string | null;
  description: string | null;
  date: string; // ISO
};

export const SELECT_CLS = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Saqlash
    </Button>
  );
}

export function TransactionDialog({
  wallets,
  savedCategories,
  transaction,
}: {
  wallets: Wallet[];
  savedCategories: Category[];
  transaction?: EditableTransaction;
}) {
  const isEdit = !!transaction;
  const initialWalletId = transaction?.walletId ?? wallets[0]?.id ?? '';
  const initialToWalletId =
    transaction?.toWalletId ?? wallets.find(w => w.id !== initialWalletId)?.id ?? initialWalletId;

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>(transaction?.type ?? 'EXPENSE');
  const [walletId, setWalletId] = useState(initialWalletId);
  const [toWalletId, setToWalletId] = useState(initialToWalletId);
  const [selectedCategory, setSelectedCategory] = useState(transaction?.category ?? '');
  const [extraCategories, setExtraCategories] = useState<Category[]>(savedCategories);
  const [state, action] = useFormState<TransactionState, FormData>(
    isEdit ? updateTransaction : addTransaction,
    null,
  );

  const fromWallet = wallets.find(w => w.id === walletId);
  const toWallet = wallets.find(w => w.id === toWalletId);
  const needsRate = type === 'TRANSFER' && fromWallet && toWallet && fromWallet.currency !== toWallet.currency;
  const higherCurrency = needsRate
    ? (CURRENCY_RANK[fromWallet!.currency] ?? 1) >= (CURRENCY_RANK[toWallet!.currency] ?? 1)
      ? fromWallet!.currency : toWallet!.currency
    : '';
  const lowerCurrency = needsRate
    ? higherCurrency === fromWallet!.currency ? toWallet!.currency : fromWallet!.currency
    : '';

  const baseCategories = type === 'INCOME' ? INCOME_DEFAULTS : EXPENSE_DEFAULTS;
  const allCategories = Array.from(new Set([
    ...baseCategories,
    ...extraCategories.map(c => c.name),
    ...(transaction?.category ? [transaction.category] : []),
  ]));
  const selectedIcon = selectedCategory
    ? getCategoryIcon(categoryIconKey(selectedCategory, extraCategories.find(c => c.name === selectedCategory)?.icon))
    : null;

  const today = toDateInput(new Date());
  const originalDate = transaction ? toDateInput(new Date(transaction.date)) : '';
  const [date, setDate] = useState(originalDate || today);
  const [repeat, setRepeat] = useState<Frequency | ''>('');

  // Takrorlash faqat yangi kirim/chiqimda; keyingi sana formada izoh sifatida ko'rsatiladi
  const canRepeat = !isEdit && type !== 'TRANSFER';
  const nextRepeat = canRepeat && repeat && date
    ? new Intl.DateTimeFormat('uz-UZ', { timeZone: APP_TZ, day: 'numeric', month: 'long', year: 'numeric' })
        .format(occurrenceDate(dayStart(date), repeat, 1))
    : null;

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  function handleOpenChange(next: boolean) {
    if (next) {
      // Har ochilganda boshlang'ich qiymatlarga qaytarish
      setType(transaction?.type ?? 'EXPENSE');
      setWalletId(initialWalletId);
      setToWalletId(initialToWalletId);
      setSelectedCategory(transaction?.category ?? '');
      setDate(originalDate || toDateInput(new Date()));
      setRepeat('');
    }
    setOpen(next);
  }

  function changeType(t: TxType) {
    setType(t);
    setSelectedCategory('');
  }

  function changeFromWallet(id: string) {
    setWalletId(id);
    // Qabul qiluvchi hamyon jo'natuvchi bilan bir xil bo'lib qolmasin
    if (toWalletId === id) {
      const other = wallets.find(w => w.id !== id);
      if (other) setToWalletId(other.id);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" />}>
        {isEdit ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Tranzaksiyani tahrirlash' : 'Yangi tranzaksiya'}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="today" value={today} />
          {isEdit && <input type="hidden" name="id" value={transaction.id} />}
          {isEdit && <input type="hidden" name="originalDate" value={originalDate} />}

          {state?.error && (
            <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>
          )}

          {/* Tur (tahrirlashda o'zgarmaydi) */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => changeType(t)}
                disabled={isEdit && t !== type}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  type === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'INCOME' ? 'Daromad' : t === 'EXPENSE' ? 'Xarajat' : "O'tkazma"}
              </button>
            ))}
          </div>

          {/* Hamyon(lar) */}
          <input type="hidden" name="walletId" value={walletId} />
          {type === 'TRANSFER' ? (
            <>
              <input type="hidden" name="toWalletId" value={toWalletId} />

              <div className="space-y-2">
                <Label>Qaysi hamyondan</Label>
                <select
                  value={walletId}
                  onChange={(e) => changeFromWallet(e.target.value)}
                  className={SELECT_CLS}
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Qaysi hamyonga</Label>
                <select
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  className={SELECT_CLS}
                >
                  {wallets.filter(w => w.id !== walletId).map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>
                  ))}
                </select>
              </div>

              {needsRate && (
                <div className="space-y-2">
                  <Label htmlFor="tx-rate">Valyuta kursi</Label>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-sm font-medium">1 {higherCurrency} =</span>
                    <Input
                      id="tx-rate"
                      name="rate"
                      type="number"
                      min="0.000001"
                      step="any"
                      placeholder="0"
                      defaultValue={transaction?.rate ?? undefined}
                      required
                      className="flex-1"
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">{lowerCurrency}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="tx-wallet">Hamyon</Label>
              <select
                id="tx-wallet"
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className={SELECT_CLS}
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>
                ))}
              </select>
            </div>
          )}

          {/* Miqdor + Sana */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tx-amount">
                Miqdor{fromWallet ? ` (${fromWallet.currency})` : ''}
              </Label>
              <Input
                id="tx-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0"
                defaultValue={transaction?.amount}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-date">Sana</Label>
              <Input
                id="tx-date"
                name="date"
                type="date"
                max={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Takrorlash */}
          {canRepeat && (
            <div className="space-y-2">
              <Label htmlFor="tx-repeat">Takrorlash</Label>
              <select
                id="tx-repeat"
                name="repeat"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as Frequency | '')}
                className={SELECT_CLS}
              >
                <option value="">Takrorlanmaydi</option>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              {nextRepeat && (
                <p className="text-xs text-muted-foreground">
                  Keyingi yozuv {nextRepeat} kuni avtomatik qo&apos;shiladi. To&apos;xtatish — Tranzaksiyalar sahifasida.
                </p>
              )}
            </div>
          )}

          {/* Kategoriya */}
          {type !== 'TRANSFER' && (
            <div className="space-y-2">
              <Label htmlFor="tx-category">Kategoriya</Label>
              <div className="flex gap-2">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  style={selectedIcon ? { backgroundColor: iconBg(selectedIcon.color) } : undefined}
                >
                  {selectedIcon
                    ? <selectedIcon.Icon className="h-4 w-4" style={{ color: selectedIcon.color }} />
                    : <span className="text-xs">—</span>}
                </div>
                <select
                  id="tx-category"
                  name="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={`flex-1 ${SELECT_CLS}`}
                >
                  <option value="">— Tanlang —</option>
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <AddCategoryDialog
                  onCreated={(cat) => {
                    setExtraCategories((prev) => [...prev, cat]);
                    setSelectedCategory(cat.name);
                  }}
                />
              </div>
            </div>
          )}

          {/* Izoh */}
          <div className="space-y-2">
            <Label htmlFor="tx-desc">Izoh (ixtiyoriy)</Label>
            <Input
              id="tx-desc"
              name="description"
              placeholder="Qo'shimcha ma'lumot..."
              defaultValue={transaction?.description ?? ''}
            />
          </div>

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
