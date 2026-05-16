'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { addTransaction, type TransactionState } from '@/lib/actions/transaction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AddCategoryDialog } from '@/components/categories/add-category-dialog';
import { Plus, Loader2 } from 'lucide-react';

const INCOME_DEFAULTS = ['Maosh', 'Bonus', 'Freelance', 'Biznes', "Sovg'a", 'Boshqa'];
const EXPENSE_DEFAULTS = ['Oziq-ovqat', 'Transport', 'Uy-joy', 'Kommunal', 'Kiyim', "Sog'liq", "Ta'lim", "Ko'ngil ochar", 'Restoran', 'Sport', 'Boshqa'];
const CURRENCY_RANK: Record<string, number> = { UZS: 1, RUB: 2, USD: 3, EUR: 4 };

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
type Wallet = { id: string; name: string; currency: string };
type Category = { id: string; name: string };

const SELECT_CLS = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Saqlash
    </Button>
  );
}

export function AddTransactionDialog({
  wallets,
  savedCategories,
}: {
  wallets: Wallet[];
  savedCategories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>('EXPENSE');
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? '');
  const [toWalletId, setToWalletId] = useState(wallets[1]?.id ?? wallets[0]?.id ?? '');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [extraCategories, setExtraCategories] = useState<Category[]>(savedCategories);
  const [state, action] = useFormState<TransactionState, FormData>(addTransaction, null);

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
  const savedNames = new Set(baseCategories);
  const allCategories = [...baseCategories, ...extraCategories.filter(c => !savedNames.has(c.name)).map(c => c.name)];

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      setType('EXPENSE');
      setSelectedCategory('');
    }
  }, [state]);

  useEffect(() => {
    setSelectedCategory('');
  }, [type]);

  // Keep toWalletId valid when fromWalletId changes
  useEffect(() => {
    if (toWalletId === walletId) {
      const other = wallets.find(w => w.id !== walletId);
      if (other) setToWalletId(other.id);
    }
  }, [walletId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" />}>
        <Plus className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yangi transaksiya</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="type" value={type} />

          {state?.error && (
            <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>
          )}

          {/* Tur */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                  type === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'INCOME' ? 'Daromad' : t === 'EXPENSE' ? 'Xarajat' : "O'tkazma"}
              </button>
            ))}
          </div>

          {/* Hamyon(lar) */}
          {type === 'TRANSFER' ? (
            <>
              <input type="hidden" name="walletId" value={walletId} />
              <input type="hidden" name="toWalletId" value={toWalletId} />

              <div className="space-y-2">
                <Label>Qaysi hamyondan</Label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
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
                name="walletId"
                defaultValue={wallets[0]?.id}
                className={SELECT_CLS}
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Miqdor */}
          <div className="space-y-2">
            <Label htmlFor="tx-amount">
              Miqdor{fromWallet ? ` (${fromWallet.currency})` : ''}
            </Label>
            <Input id="tx-amount" name="amount" type="number" min="1" placeholder="0" required />
          </div>

          {/* Kategoriya */}
          {type !== 'TRANSFER' && (
            <div className="space-y-2">
              <Label htmlFor="tx-category">Kategoriya</Label>
              <div className="flex gap-2">
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
            <Input id="tx-desc" name="description" placeholder="Qo'shimcha ma'lumot..." />
          </div>

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
