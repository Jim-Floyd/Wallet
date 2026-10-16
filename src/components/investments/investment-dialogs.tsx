'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import {
  addInvestmentIncome, revalueInvestment, sellInvestment, type InvestmentState,
} from '@/lib/actions/investment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/components/amount-input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SELECT_CLS } from '@/components/transactions/transaction-dialog';
import { toDateInput } from '@/lib/form-date';
import { formatMoney, formatMoneySigned } from '@/lib/intl';

export type InvestmentInfo = { id: string; name: string; currency: string; book: number; market: number };
type Wallet = { id: string; name: string; currency: string };

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

// Uchala oyna uchun umumiy qobiq: matnli tugma, sarlavha, xato, muvaffaqiyatda yopiladi
function InvestmentDialog({
  label, title, description, state, action, onOpen, children,
}: {
  label: string; title: string; description: string;
  state: InvestmentState; action: (formData: FormData) => void; onOpen?: () => void; children: (reset: number) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reset, setReset] = useState(0); // har ochilganda maydonlar qayta yaratiladi
  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (next) { setReset(r => r + 1); onOpen?.(); } setOpen(next); }}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-7 text-xs" />}>{label}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state?.error && <Alert variant="destructive" className="py-2 text-sm">{state.error}</Alert>}
          {children(reset)}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DateAndNote({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations('investments');
  const today = toDateInput(new Date());
  return (
    <>
      <input type="hidden" name="today" value={today} />
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-date`}>{t('date')}</Label>
        <Input id={`${idPrefix}-date`} name="date" type="date" max={today} defaultValue={today} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-note`}>{t('note')}</Label>
        <Input id={`${idPrefix}-note`} name="description" placeholder={t('notePlaceholder')} />
      </div>
    </>
  );
}

// Daromad olish (masalan, IMAN oylik foydasi): investitsiyada qoldirish yoki boshqa hamyonga olish
export function InvestmentIncomeDialog({ investment, wallets }: { investment: InvestmentInfo; wallets: Wallet[] }) {
  const t = useTranslations('investments');
  const [state, action] = useFormState<InvestmentState, FormData>(addInvestmentIncome, null);
  const targets = wallets.filter(w => w.currency === investment.currency && w.id !== investment.id);
  return (
    <InvestmentDialog label={t('income')} title={t('incomeTitle', { name: investment.name })} description={t('incomeHint')} state={state} action={action}>
      {(reset) => (
        <>
          <input type="hidden" name="investmentId" value={investment.id} />
          <div className="space-y-2">
            <Label htmlFor="inv-income-amount">{t('amount')} ({investment.currency})</Label>
            <AmountInput key={reset} id="inv-income-amount" name="amount" placeholder="0" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-income-wallet">{t('incomeWhere')}</Label>
            <select key={reset} id="inv-income-wallet" name="walletId" defaultValue={investment.id} className={SELECT_CLS}>
              <option value={investment.id}>{t('keepInside', { name: investment.name })}</option>
              {targets.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}
            </select>
          </div>
          <DateAndNote idPrefix="inv-income" />
          <SubmitButton />
        </>
      )}
    </InvestmentDialog>
  );
}

// Joriy qiymatni yangilash: daromadga kirmaydi, faqat portfel qiymati va realizatsiya qilinmagan natija
export function RevalueDialog({ investment }: { investment: InvestmentInfo }) {
  const t = useTranslations('investments');
  const locale = useLocale();
  const [state, action] = useFormState<InvestmentState, FormData>(revalueInvestment, null);
  const [value, setValue] = useState(investment.market);
  const diff = value - investment.book;
  return (
    <InvestmentDialog
      label={t('revalue')}
      title={t('revalueTitle', { name: investment.name })}
      onOpen={() => setValue(investment.market)}
      description={t('revalueHint', { book: formatMoney(investment.book, investment.currency, locale) })}
      state={state}
      action={action}
    >
      {(reset) => (
        <>
          <input type="hidden" name="investmentId" value={investment.id} />
          <div className="space-y-2">
            <Label htmlFor="inv-value">{t('currentValue')} ({investment.currency})</Label>
            <AmountInput key={reset} id="inv-value" name="value" defaultValue={investment.market} onValueChange={setValue} required />
            <p className={`text-xs font-medium ${diff > 0 ? 'text-green-700 dark:text-green-500' : diff < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {t('revaluation')}: {formatMoneySigned(diff, investment.currency, locale)}
            </p>
          </div>
          <SubmitButton />
        </>
      )}
    </InvestmentDialog>
  );
}

// Sotish / chiqarish: qancha olindi, qaysi hamyonga, qancha qismi sotildi (%). Ilova tannarx va foydani ajratadi
export function SellDialog({ investment, wallets }: { investment: InvestmentInfo; wallets: Wallet[] }) {
  const t = useTranslations('investments');
  const locale = useLocale();
  const [state, action] = useFormState<InvestmentState, FormData>(sellInvestment, null);
  const targets = wallets.filter(w => w.currency === investment.currency && w.id !== investment.id);
  const [received, setReceived] = useState(0);
  const [share, setShare] = useState(100);
  const principal = Math.max(investment.book, 0) * (Math.min(Math.max(share, 0), 100) / 100);
  const profit = received - principal;
  return (
    <InvestmentDialog
      label={t('sell')}
      title={t('sellTitle', { name: investment.name })}
      onOpen={() => { setReceived(0); setShare(100); }}
      description={t('sellHint')}
      state={state}
      action={action}
    >
      {(reset) => targets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noTargetWallet', { currency: investment.currency })}</p>
      ) : (
        <>
          <input type="hidden" name="investmentId" value={investment.id} />
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-sell-amount">{t('received')} ({investment.currency})</Label>
              <AmountInput key={`a${reset}`} id="inv-sell-amount" name="amount" placeholder="0" onValueChange={setReceived} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-sell-share">{t('share')}</Label>
              <Input
                key={`s${reset}`}
                id="inv-sell-share"
                name="share"
                type="number"
                min={1}
                max={100}
                step="any"
                defaultValue={100}
                onChange={(e) => setShare(Number(e.target.value) || 0)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-sell-wallet">{t('sellTo')}</Label>
            <select key={`w${reset}`} id="inv-sell-wallet" name="walletId" defaultValue={targets[0].id} className={SELECT_CLS}>
              {targets.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}
            </select>
          </div>
          <div className="space-y-1 rounded-lg bg-muted/60 px-3 py-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('principalBack')}</span>
              <span className="tabular-nums">{formatMoney(Math.min(received, principal), investment.currency, locale)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>{profit >= 0 ? t('profit') : t('loss')}</span>
              <span className={`tabular-nums ${profit > 0 ? 'text-green-700 dark:text-green-500' : profit < 0 ? 'text-red-600' : ''}`}>
                {formatMoneySigned(profit, investment.currency, locale)}
              </span>
            </div>
          </div>
          <DateAndNote idPrefix="inv-sell" />
          <SubmitButton />
        </>
      )}
    </InvestmentDialog>
  );
}
