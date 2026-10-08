'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { addTransaction, updateTransaction, type TransactionState } from '@/lib/actions/transaction';
import { addDebt, addDebtPayment, type DebtState } from '@/lib/actions/debt';
import type { OpenDebtOption } from '@/lib/debt';
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
import { formatMoney, formatMoneySigned } from '@/lib/intl';
import { dayKey, dayStart } from '@/lib/days';
import { FREQUENCIES, occurrenceDate, type Frequency } from '@/lib/recurring';
import { CURRENCY_RANK } from '@/lib/currency';
import { EXPENSE_DEFAULTS, INCOME_DEFAULTS, categoryIconKey, categoryName, getCategoryIcon, iconBg } from '@/lib/category-icons';

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
// DEBT — faqat yangi yozuvda: yangi qarz → addDebt, ochiq qarzni qaytarish → addDebtPayment
type FormType = TxType | 'DEBT';
type DebtMode = 'LENT' | 'BORROWED' | 'REPAY';
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

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations('common');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {t('save')}
    </Button>
  );
}

export function TransactionDialog({
  wallets,
  savedCategories,
  transaction,
  openDebts = [],
}: {
  wallets: Wallet[];
  savedCategories: Category[];
  transaction?: EditableTransaction;
  openDebts?: OpenDebtOption[];
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
  const [debtMode, setDebtMode] = useState<DebtMode>('LENT');
  const [debtId, setDebtId] = useState(openDebts[0]?.id ?? '');
  const [walletId, setWalletId] = useState(initialWalletId);
  const [toWalletId, setToWalletId] = useState(initialToWalletId);
  const [selectedCategory, setSelectedCategory] = useState(transaction?.category ?? '');
  const [extraCategories, setExtraCategories] = useState<Category[]>(savedCategories);
  const [state, action] = useFormState<TransactionState, FormData>(
    isEdit ? updateTransaction : addTransaction,
    null,
  );
  const [debtState, debtAction] = useFormState<DebtState, FormData>(addDebt, null);
  const [payState, payAction] = useFormState<DebtState, FormData>(addDebtPayment, null);
  const isDebt = type === 'DEBT';
  const isRepay = isDebt && debtMode === 'REPAY';
  const error = isRepay ? payState?.error : isDebt ? debtState?.error : state?.error;

  // Qaytarish faqat qarz valyutasidagi hamyon orqali
  const selectedDebt = openDebts.find(d => d.id === debtId);
  const walletChoices = isRepay && selectedDebt ? wallets.filter(w => w.currency === selectedDebt.currency) : wallets;
  const repayBlocked = isRepay && (!selectedDebt || walletChoices.length === 0);

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
  const outflow = type === 'EXPENSE' || type === 'TRANSFER' || (isDebt && debtMode === 'LENT')
    || (isRepay && selectedDebt?.type === 'BORROWED');
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
    if (state?.success || debtState?.success || payState?.success) setOpen(false);
  }, [state, debtState, payState]);

  // Qarz tanlanganda: hamyon shu valyutadagisiga almashadi, summa — qolgan qarz
  function pickDebt(id: string) {
    const debt = openDebts.find(d => d.id === id);
    setDebtId(id);
    if (!debt) return;
    if (fromWallet?.currency !== debt.currency) {
      setWalletId(wallets.find(w => w.currency === debt.currency)?.id ?? walletId);
    }
    setAmount(debt.remaining);
  }

  function changeDebtMode(next: DebtMode) {
    setDebtMode(next);
    if (next === 'REPAY') pickDebt(debtId || openDebts[0]?.id || '');
    else if (debtMode === 'REPAY') setAmount(0); // summa maydoni qayta yaratiladi va bo'sh bo'ladi
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      // Har ochilganda boshlang'ich qiymatlarga qaytarish
      setType(transaction?.type ?? 'EXPENSE');
      setDebtMode('LENT');
      setDebtId(openDebts[0]?.id ?? '');
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
    if (isRepay) changeDebtMode('LENT');
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
        <form action={isRepay ? payAction : isDebt ? debtAction : action} className="space-y-4">
          <input type="hidden" name="type" value={isDebt ? debtMode : type} />
          {isRepay && <input type="hidden" name="debtId" value={debtId} />}
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

          {/* Qarz: berdim / oldim / ochiq qarzni qaytarish */}
          {isDebt && (
            <div className="grid grid-cols-3 gap-1 rounded-lg border p-1">
              {(['LENT', 'BORROWED', 'REPAY'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeDebtMode(value)}
                  className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                    debtMode === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {value === 'LENT' ? td('iLent') : value === 'BORROWED' ? td('iBorrowed') : t('debtRepay')}
                </button>
              ))}
            </div>
          )}

          {isDebt && !isRepay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tx-person">{debtMode === 'LENT' ? td('personTo') : td('personFrom')}</Label>
                <Input id="tx-person" name="person" placeholder={td('personPlaceholder')} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tx-phone">{td('phone')}</Label>
                <Input id="tx-phone" name="phone" type="tel" placeholder="+998..." />
              </div>
            </div>
          )}

          {isRepay && (
            openDebts.length === 0 ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{td('noOpen')}</p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="tx-debt">{t('selectDebt')}</Label>
                <select id="tx-debt" value={debtId} onChange={(e) => pickDebt(e.target.value)} className={SELECT_CLS}>
                  {openDebts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.person} — {d.type === 'LENT' ? td('owedToMe') : td('iOwe')} · {td('left', { amount: formatMoney(d.remaining, d.currency, locale) })}
                    </option>
                  ))}
                </select>
                {selectedDebt && walletChoices.length === 0 && (
                  <p className="text-xs text-amber-600">{td('noMatchingWallet', { currency: selectedDebt.currency })}</p>
                )}
              </div>
            )
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
          ) : !repayBlocked && (
            <div className="space-y-2">
              <Label htmlFor="tx-wallet">
                {isRepay
                  ? td(selectedDebt?.type === 'LENT' ? 'walletRepaid' : 'walletPaid')
                  : isDebt ? td(debtMode === 'LENT' ? 'walletLent' : 'walletBorrowed') : t('wallet')}
              </Label>
              <select
                id="tx-wallet"
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className={SELECT_CLS}
              >
                {walletChoices.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>
                ))}
              </select>
            </div>
          )}

          {/* Miqdor + Sana */}
          {!repayBlocked && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tx-amount">
                {t('amount')}{fromWallet ? ` (${fromWallet.currency})` : ''}
              </Label>
              {/* Qaytarishda qarz almashganda maydon qayta yaratiladi — standart qiymat qolgan qarz */}
              <AmountInput
                key={isRepay ? `repay-${debtId}` : 'amount'}
                id="tx-amount"
                name="amount"
                placeholder="0"
                defaultValue={isRepay ? selectedDebt?.remaining : transaction?.amount}
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
          )}

          {isRepay && selectedDebt && !repayBlocked && (
            <p className="-mt-2 text-xs text-muted-foreground">
              {td('remainingDebt', { amount: formatMoney(selectedDebt.remaining, selectedDebt.currency, locale) })}
            </p>
          )}

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

          {/* Qarz qaytarish muddati (faqat yangi qarzda) */}
          {isDebt && !isRepay && (
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

          <SubmitButton disabled={repayBlocked} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
