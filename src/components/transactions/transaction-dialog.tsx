'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { addTransaction, updateTransaction, type TransactionState } from '@/lib/actions/transaction';
import { addDebt, type DebtState } from '@/lib/actions/debt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/components/amount-input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AddCategoryDialog } from '@/components/categories/add-category-dialog';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { toDateInput } from '@/lib/form-date';
import { useLocale, useTranslations } from 'next-intl';
import { formatMoneySigned } from '@/lib/intl';
import { dayKey, dayStart } from '@/lib/days';
import { FREQUENCIES, occurrenceDate, type Frequency } from '@/lib/recurring';
import { CURRENCY_RANK } from '@/lib/currency';
import { EXPENSE_DEFAULTS, INCOME_DEFAULTS, categoryIconKey, categoryName, getCategoryIcon, iconBg } from '@/lib/category-icons';

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
// DEBT — faqat yangi yozuvda: forma Qarzlar bo'limidagi addDebt ga yuboriladi
type FormType = TxType | 'DEBT';
type DebtType = 'LENT' | 'BORROWED';
// available — kredit hamyonda hozirgi mavjud mablag' (limit + qoldiq), debetda null
export type TxWallet = { id: string; name: string; currency: string; available?: number | null };
type Wallet = TxWallet;
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
  const t = useTranslations('common');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {t('save')}
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
  const t = useTranslations('transactions');
  const tc = useTranslations('common');
  const tCat = useTranslations('defaultCategories');
  const td = useTranslations('debts');
  const locale = useLocale();
  const isEdit = !!transaction;
  const initialWalletId = transaction?.walletId ?? wallets[0]?.id ?? '';
  const initialToWalletId =
    transaction?.toWalletId ?? wallets.find(w => w.id !== initialWalletId)?.id ?? initialWalletId;

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FormType>(transaction?.type ?? 'EXPENSE');
  const [debtType, setDebtType] = useState<DebtType>('LENT');
  const [walletId, setWalletId] = useState(initialWalletId);
  const [toWalletId, setToWalletId] = useState(initialToWalletId);
  const [selectedCategory, setSelectedCategory] = useState(transaction?.category ?? '');
  const [extraCategories, setExtraCategories] = useState<Category[]>(savedCategories);
  const [state, action] = useFormState<TransactionState, FormData>(
    isEdit ? updateTransaction : addTransaction,
    null,
  );
  const [debtState, debtAction] = useFormState<DebtState, FormData>(addDebt, null);
  const isDebt = type === 'DEBT';
  const error = isDebt ? debtState?.error : state?.error;

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
  const [amount, setAmount] = useState(transaction?.amount ?? 0);

  // Kredit hamyondan chiqim/o'tkazma limitdan oshsa — ogohlantirish (saqlashga to'sqinlik qilmaydi).
  // Tahrirlashda eski summa allaqachon ayirilgan — mavjudga qaytarib qo'shiladi
  const outflow = type === 'EXPENSE' || type === 'TRANSFER' || (isDebt && debtType === 'LENT');
  const creditAvailable = outflow && fromWallet?.available != null
    ? fromWallet.available + (isEdit && transaction.walletId === walletId ? transaction.amount : 0)
    : null;
  const overCredit = creditAvailable != null && amount > creditAvailable;

  // Takrorlash faqat yangi kirim/chiqimda; keyingi sana formada izoh sifatida ko'rsatiladi.
  // Raqamli "kun.oy.yil": brauzerlarda o'zbekcha oy nomlari yo'q (Intl "M10" qaytaradi)
  const canRepeat = !isEdit && (type === 'INCOME' || type === 'EXPENSE');
  const nextRepeat = canRepeat && repeat && date
    ? dayKey(occurrenceDate(dayStart(date), repeat, 1)).split('-').reverse().join('.')
    : null;

  useEffect(() => {
    if (state?.success || debtState?.success) setOpen(false);
  }, [state, debtState]);

  function handleOpenChange(next: boolean) {
    if (next) {
      // Har ochilganda boshlang'ich qiymatlarga qaytarish
      setType(transaction?.type ?? 'EXPENSE');
      setDebtType('LENT');
      setWalletId(initialWalletId);
      setToWalletId(initialToWalletId);
      setSelectedCategory(transaction?.category ?? '');
      setDate(originalDate || toDateInput(new Date()));
      setRepeat('');
      setAmount(transaction?.amount ?? 0);
    }
    setOpen(next);
  }

  function changeType(next: FormType) {
    setType(next);
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
          <DialogTitle>{isEdit ? t('editTitle') : t('newTitle')}</DialogTitle>
        </DialogHeader>
        <form action={isDebt ? debtAction : action} className="space-y-4">
          <input type="hidden" name="type" value={isDebt ? debtType : type} />
          <input type="hidden" name="today" value={today} />
          {isEdit && <input type="hidden" name="id" value={transaction.id} />}
          {isEdit && <input type="hidden" name="originalDate" value={originalDate} />}

          {error && (
            <Alert variant="destructive" className="text-sm py-2">{error}</Alert>
          )}

          {/* Tur (tahrirlashda o'zgarmaydi; qarz — faqat yangi yozuvda) */}
          <div className={`grid gap-1 rounded-lg bg-muted p-1 ${isEdit ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {(isEdit ? (['EXPENSE', 'INCOME', 'TRANSFER'] as const) : (['EXPENSE', 'INCOME', 'TRANSFER', 'DEBT'] as const)).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeType(value)}
                disabled={isEdit && value !== type}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  type === value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {value === 'DEBT' ? t('filter.DEBT') : t(value.toLowerCase())}
              </button>
            ))}
          </div>

          {/* Qarz: berdim/oldim + kim bilan */}
          {isDebt && (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">
                {(['LENT', 'BORROWED'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDebtType(value)}
                    className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                      debtType === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {value === 'LENT' ? td('iLent') : td('iBorrowed')}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tx-person">{debtType === 'LENT' ? td('personTo') : td('personFrom')}</Label>
                  <Input id="tx-person" name="person" placeholder={td('personPlaceholder')} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tx-phone">{td('phone')}</Label>
                  <Input id="tx-phone" name="phone" type="tel" placeholder="+998..." />
                </div>
              </div>
            </>
          )}

          {/* Hamyon(lar) */}
          <input type="hidden" name="walletId" value={walletId} />
          {type === 'TRANSFER' ? (
            <>
              <input type="hidden" name="toWalletId" value={toWalletId} />

              <div className="space-y-2">
                <Label>{t('fromWallet')}</Label>
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
                <Label>{t('toWallet')}</Label>
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
                  <Label htmlFor="tx-rate">{t('rate')}</Label>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-sm font-medium">1 {higherCurrency} =</span>
                    <AmountInput
                      id="tx-rate"
                      name="rate"
                      decimals={6}
                      placeholder="0"
                      defaultValue={transaction?.rate}
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
              <Label htmlFor="tx-wallet">
                {isDebt ? td(debtType === 'LENT' ? 'walletLent' : 'walletBorrowed') : t('wallet')}
              </Label>
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
                {t('amount')}{fromWallet ? ` (${fromWallet.currency})` : ''}
              </Label>
              <AmountInput
                id="tx-amount"
                name="amount"
                placeholder="0"
                defaultValue={transaction?.amount}
                onValueChange={setAmount}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-date">{t('date')}</Label>
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

          {overCredit && fromWallet && (
            <p className="-mt-2 text-xs font-medium text-amber-600">
              {t('overCreditLimit', { available: formatMoneySigned(creditAvailable!, fromWallet.currency, locale) })}
            </p>
          )}

          {/* Takrorlash */}
          {canRepeat && (
            <div className="space-y-2">
              <Label htmlFor="tx-repeat">{t('repeat')}</Label>
              <select
                id="tx-repeat"
                name="repeat"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as Frequency | '')}
                className={SELECT_CLS}
              >
                <option value="">{t('noRepeat')}</option>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{t(`freq.${f}`)}</option>
                ))}
              </select>
              {nextRepeat && (
                <p className="text-xs text-muted-foreground">
                  {t('repeatHint', { date: nextRepeat })}
                </p>
              )}
            </div>
          )}

          {/* Qarz qaytarish muddati */}
          {isDebt && (
            <div className="space-y-2">
              <Label htmlFor="tx-due">{td('dueDate')}</Label>
              <Input id="tx-due" name="dueDate" type="date" />
            </div>
          )}

          {/* Kategoriya */}
          {(type === 'INCOME' || type === 'EXPENSE') && (
            <div className="space-y-2">
              <Label htmlFor="tx-category">{t('category')}</Label>
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
                  <option value="">{tc('select')}</option>
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>{categoryName(cat, tCat)}</option>
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
            <Label htmlFor="tx-desc">{t('note')}</Label>
            <Input
              id="tx-desc"
              name="description"
              placeholder={t('notePlaceholder')}
              defaultValue={transaction?.description ?? ''}
            />
          </div>

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
