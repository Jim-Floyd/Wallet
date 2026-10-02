import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Wallet, CreditCard, HandCoins } from 'lucide-react';
import { debtProgress, debtTxLabel } from '@/lib/debt';
import { dayKey, dueInfo, formatDay, monthStart, parseMonthParams } from '@/lib/days';
import { MonthlyFlowCard } from '@/components/dashboard/monthly-flow-card';
import { formatMoney, formatMoneySigned } from '@/lib/intl';
import { balanceEffects } from '@/lib/balance';
import { CURRENCY_RANK } from '@/lib/currency';
import { MonthNav } from '@/components/month-nav';
import { Suspense } from 'react';
import { categoryName } from '@/lib/category-icons';
import { processRecurring } from '@/lib/recurring-server';
import { WalletAvatar } from '@/components/wallets/wallet-avatar';
import { CreditUsage } from '@/components/wallets/credit-usage';
import { creditInfo, walletOption } from '@/lib/credit';
import { EditWalletDialog } from '@/components/wallets/edit-wallet-dialog';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { deleteWallet } from '@/lib/actions/wallet';
import { TransactionActions } from '@/components/transactions/transaction-actions';
import { TxIcon } from '@/components/transactions/tx-icon';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { AddWalletDialog } from '@/components/dashboard/add-wallet-dialog';
import { TransactionDialog } from '@/components/transactions/transaction-dialog';

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { locale } = await params;
  const { month, year } = parseMonthParams(await searchParams);
  const t = await getTranslations('dashboard');
  const tc = await getTranslations('transactions');
  const tDebt = await getTranslations('debts');
  const tDays = await getTranslations('days');
  const tCat = await getTranslations('defaultCategories');
  const tw = await getTranslations('wallets');
  const formatAmount = (amount: number, currency = 'UZS') => formatMoney(amount, currency, locale);
  const formatDate = (date: Date) => formatDay(date, locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth/login`);
  await processRecurring(user.id);

  // Tanlangan oy (Toshkent vaqti): oylik kirim/chiqim, oy oxiridagi qoldiqlar va oyning oxirgi tranzaksiyalari.
  // Qarzlar va tranzaksiya oynalaridagi hamyonlar ro'yxati — doim hozirgi holat
  const monthFrom = monthStart(year, month);
  const monthTo = monthStart(year, month + 1);
  const monthLabel = formatDay(monthFrom, locale, { month: 'long', year: 'numeric' });
  const isPastMonth = monthTo.getTime() <= Date.now();
  const asOfLabel = formatDay(new Date(monthTo.getTime() - 1), locale);

  const [wallets, categories, monthTxs, recentTransactions, debtRows, laterTxs, earlierFrom, earlierTo] = await Promise.all([
    prisma.wallet.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    }),
    // Oyning kirim/chiqimlari: kartalardagi jami va bosilganda ochiladigan ro'yxat uchun
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: { gte: monthFrom, lt: monthTo },
        type: { in: ['INCOME', 'EXPENSE'] },
      },
      orderBy: { date: 'desc' },
      select: {
        id: true, type: true, amount: true, currency: true, category: true, description: true, date: true,
        wallet: { select: { name: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: monthFrom, lt: monthTo } },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        wallet: { select: { name: true, currency: true } },
        toWallet: { select: { name: true, currency: true } },
        debt: { select: { type: true, person: true } },
      },
    }),
    prisma.debt.findMany({
      where: { userId: user.id },
      include: { transactions: { select: { type: true, amount: true } } },
    }),
    // Oy tugagandan keyingi yozuvlar — qoldiqni oy oxiriga qaytarish uchun
    prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: monthTo } },
      select: { type: true, walletId: true, toWalletId: true, amount: true, toAmount: true },
    }),
    // Oy oxirigacha yozuvi bor hamyonlar (hamyon keyinroq qo'shilib, eski sana bilan to'ldirilgan bo'lishi mumkin)
    prisma.transaction.groupBy({ by: ['walletId'], where: { userId: user.id, date: { lt: monthTo } } }),
    prisma.transaction.groupBy({ by: ['toWalletId'], where: { userId: user.id, date: { lt: monthTo }, toWalletId: { not: null } } }),
  ]);

  // Oy oxiridagi qoldiq = hozirgi qoldiq − keyingi yozuvlar ta'siri.
  // Ko'rsatiladi: oy oxirigacha ochilgan yoki oy oxirigacha yozuvi bor hamyonlar
  const laterEffect = new Map<string, number>();
  for (const e of laterTxs.flatMap(tx => balanceEffects(tx))) {
    laterEffect.set(e.walletId, (laterEffect.get(e.walletId) ?? 0) + e.delta);
  }
  const activeByMonthEnd = new Set([...earlierFrom.map(r => r.walletId), ...earlierTo.map(r => r.toWalletId)]);
  const shownWallets = wallets
    .filter(w => w.createdAt < monthTo || activeByMonthEnd.has(w.id))
    .map(w => ({ ...w, balance: Number(w.balance) - (laterEffect.get(w.id) ?? 0) }));

  const walletList = wallets.map(walletOption);
  const categoryList = categories.map(c => ({ id: c.id, name: c.name, icon: c.icon }));
  const categoryIcons = Object.fromEntries(categories.map(c => [c.name, c.icon]));

  // Ochiq qarzlar: valyuta bo'yicha qoldiq
  const openDebts = debtRows
    .map(d => ({ ...d, progress: debtProgress(d) }))
    .filter(d => !d.progress.closed);
  const debtTotals = (type: 'LENT' | 'BORROWED') =>
    Object.entries(
      openDebts
        .filter(d => d.type === type)
        .reduce<Record<string, number>>((acc, d) => {
          acc[d.currency] = (acc[d.currency] ?? 0) + d.progress.remaining;
          return acc;
        }, {}),
    );
  const owedToMe = debtTotals('LENT');
  const iOwe = debtTotals('BORROWED');
  // Muddati eng yaqinlari birinchi (o'tganlari eng tepada), muddatsizlari oxirida — eng yangisi oldin
  const upcomingDebts = [...openDebts]
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.date.getTime() - a.date.getTime();
    })
    .slice(0, 5);

  const totalBalanceUZS = shownWallets
    .filter(w => w.currency === 'UZS')
    .reduce((sum, w) => sum + Number(w.balance), 0);

  const otherCurrencies = shownWallets
    .filter(w => w.currency !== 'UZS')
    .reduce<Record<string, number>>((acc, w) => {
      acc[w.currency] = (acc[w.currency] ?? 0) + Number(w.balance);
      return acc;
    }, {});
  // Oylik kirim/chiqim valyuta bo'yicha alohida (har xil valyutani qo'shib bo'lmaydi); so'm birinchi.
  // Kartani bosganda ochiladigan oyna uchun kategoriyalar jami va yozuvlar ro'yxati — matnlari serverda formatlanadi
  const byRank = (a: string, b: string) => (CURRENCY_RANK[a] ?? 9) - (CURRENCY_RANK[b] ?? 9);
  const firstDay = dayKey(monthFrom);
  const lastDay = dayKey(new Date(monthTo.getTime() - 1));
  const monthlyFlow = (type: 'INCOME' | 'EXPENSE') => {
    const sign = type === 'INCOME' ? '+' : '-';
    const rows = monthTxs.filter(tx => tx.type === type);
    const totals = new Map<string, number>();
    const cats = new Map<string, { category: string | null; currency: string; amount: number }>();
    for (const tx of rows) {
      const amount = Number(tx.amount);
      totals.set(tx.currency, (totals.get(tx.currency) ?? 0) + amount);
      const key = `${tx.category ?? ''}::${tx.currency}`;
      const c = cats.get(key) ?? { category: tx.category, currency: tx.currency, amount: 0 };
      c.amount += amount;
      cats.set(key, c);
    }
    const sums = Array.from(totals, ([currency, amount]) => ({ currency, amount })).sort((a, b) => byRank(a.currency, b.currency));
    const multiCurrency = sums.length > 1;
    const fallback = tc(type === 'INCOME' ? 'income' : 'expense');
    return {
      sums: sums.length > 0 ? sums : [{ currency: 'UZS', amount: 0 }],
      totals: (sums.length > 0 ? sums : [{ currency: 'UZS', amount: 0 }]).map(s => `${sign}${formatAmount(s.amount, s.currency)}`),
      categories: Array.from(cats.values())
        .sort((a, b) => byRank(a.currency, b.currency) || b.amount - a.amount)
        .map(c => ({
          label: `${c.category ? categoryName(c.category, tCat) : fallback}${multiCurrency ? ` (${c.currency})` : ''}`,
          amount: formatAmount(c.amount, c.currency),
          pct: (c.amount / (totals.get(c.currency) || 1)) * 100,
        })),
      items: rows.map(tx => ({
        id: tx.id,
        date: formatDay(tx.date, locale, { day: 'numeric', month: 'short' }),
        title: tx.category ? categoryName(tx.category, tCat) : fallback,
        subtitle: [tx.wallet.name, tx.description].filter(Boolean).join(' · '),
        amount: `${sign}${formatAmount(Number(tx.amount), tx.currency)}`,
      })),
      href: `/${locale}/transactions?type=${type}&from=${firstDay}&to=${lastDay}`,
    };
  };
  const incomeFlow = monthlyFlow('INCOME');
  const expenseFlow = monthlyFlow('EXPENSE');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Suspense>
          <MonthNav month={month} year={year} />
        </Suspense>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalBalance')}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBalanceUZS < 0 ? 'text-red-600' : ''}`}>
              {formatMoneySigned(totalBalanceUZS, 'UZS', locale)}
            </div>
            {Object.entries(otherCurrencies).map(([cur, bal]) => (
              <div key={cur} className={`text-sm font-medium ${bal < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {bal < 0 ? '-' : '+'} {formatAmount(bal, cur)}
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-1">
              {t('walletCount', { count: shownWallets.length })}
              {isPastMonth && ` · ${t('asOf', { date: asOfLabel })}`}
            </p>
          </CardContent>
        </Card>

        <MonthlyFlowCard
          kind="income"
          title={t('monthlyIncome')}
          monthLabel={monthLabel}
          totals={incomeFlow.totals}
          categories={incomeFlow.categories}
          items={incomeFlow.items}
          href={incomeFlow.href}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('monthlyIncome')}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {incomeFlow.sums.map(({ currency, amount }, i) => (
              <div key={currency} className={i === 0 ? 'text-2xl font-bold text-green-500' : 'text-sm font-medium text-green-600'}>
                +{formatAmount(amount, currency)}
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-1">{monthLabel} · {t('tapForDetails')}</p>
          </CardContent>
        </MonthlyFlowCard>

        <MonthlyFlowCard
          kind="expense"
          title={t('monthlyExpense')}
          monthLabel={monthLabel}
          totals={expenseFlow.totals}
          categories={expenseFlow.categories}
          items={expenseFlow.items}
          href={expenseFlow.href}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('monthlyExpense')}
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {expenseFlow.sums.map(({ currency, amount }, i) => (
              <div key={currency} className={i === 0 ? 'text-2xl font-bold text-red-500' : 'text-sm font-medium text-red-600'}>
                -{formatAmount(amount, currency)}
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-1">{monthLabel} · {t('tapForDetails')}</p>
          </CardContent>
        </MonthlyFlowCard>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="space-y-4">
        {/* Wallets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t('myWallets')}
              </span>
              <AddWalletDialog />
            </CardTitle>
            {isPastMonth && <p className="text-xs text-muted-foreground">{t('asOf', { date: asOfLabel })}</p>}
          </CardHeader>
          <CardContent className="space-y-3">
            {shownWallets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noWallets')}</p>
            ) : (
              shownWallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <WalletAvatar icon={wallet.icon} color={wallet.color} currency={wallet.currency} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{wallet.name} <span className="text-muted-foreground font-normal">({wallet.currency})</span></p>
                      {creditInfo(wallet) && <CreditUsage info={creditInfo(wallet)!} currency={wallet.currency} />}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${Number(wallet.balance) < 0 ? 'text-red-600' : ''}`}>
                        {formatMoneySigned(Number(wallet.balance), wallet.currency, locale)}
                      </p>
                      {wallet.isDefault && (
                        <p className="text-xs text-primary">{tw('default')}</p>
                      )}
                    </div>
                    <EditWalletDialog
                      className="h-7 w-7 text-muted-foreground"
                      wallet={{
                        id: wallet.id,
                        name: wallet.name,
                        currency: wallet.currency,
                        color: wallet.color,
                        icon: wallet.icon,
                        isDefault: wallet.isDefault,
                        kind: wallet.kind,
                        creditLimit: wallet.creditLimit == null ? null : Number(wallet.creditLimit),
                      }}
                    />
                    {wallet.isDefault ? (
                      // O'chirish tugmasi o'rnini egallab turadi — qatorlar tekis bo'lishi uchun
                      <span className="h-7 w-7" />
                    ) : (
                      <ConfirmDeleteButton
                        id={wallet.id}
                        action={deleteWallet}
                        title={tw('deleteTitle')}
                        description={tw('deleteDescription', { name: wallet.name })}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Debts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <HandCoins className="h-5 w-5" />
                {tDebt('title')}
              </span>
              <Link href={`/${locale}/debts`} className="text-xs font-normal text-muted-foreground hover:text-foreground">
                {t('seeAll')}
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openDebts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tDebt('noOpen')}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-green-50 p-2 dark:bg-green-950/30">
                    <p className="text-xs text-muted-foreground">{tDebt('owedToMe')}</p>
                    {owedToMe.length === 0
                      ? <p className="font-semibold text-muted-foreground">0</p>
                      : owedToMe.map(([cur, v]) => (
                        <p key={cur} className="font-semibold text-green-600">{formatAmount(v, cur)}</p>
                      ))}
                  </div>
                  <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950/30">
                    <p className="text-xs text-muted-foreground">{tDebt('iOwe')}</p>
                    {iOwe.length === 0
                      ? <p className="font-semibold text-muted-foreground">0</p>
                      : iOwe.map(([cur, v]) => (
                        <p key={cur} className="font-semibold text-red-600">{formatAmount(v, cur)}</p>
                      ))}
                  </div>
                </div>

                <div className="divide-y rounded-lg border">
                  {upcomingDebts.map((d) => {
                    const isLent = d.type === 'LENT';
                    const due = d.dueDate ? dueInfo(d.dueDate, tDays, locale) : null;
                    return (
                      <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{d.person}</p>
                          <p className={`text-xs ${
                            due?.tone === 'overdue' ? 'font-medium text-red-600'
                              : due?.tone === 'soon' ? 'font-medium text-amber-600'
                              : 'text-muted-foreground'
                          }`}>
                            {due ? due.text : tDebt('noDueDate')}
                          </p>
                        </div>
                        <p className={`shrink-0 text-sm font-semibold tabular-nums ${isLent ? 'text-green-600' : 'text-red-600'}`}>
                          {isLent ? '+' : '-'}{formatAmount(d.progress.remaining, d.currency)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {openDebts.length > upcomingDebts.length && (
                  <Link href={`/${locale}/debts`} className="block text-center text-xs text-muted-foreground hover:text-foreground">
                    {t('moreDebts', { count: openDebts.length - upcomingDebts.length })}
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Recent transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t('recentTransactions')}</span>
              <TransactionDialog wallets={walletList} savedCategories={categoryList} />
            </CardTitle>
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noTransactions')}</p>
            ) : (
              recentTransactions.map((tx) => {
                const isIncome = tx.type === 'INCOME' || tx.type === 'DEBT_IN';
                const isTransfer = tx.type === 'TRANSFER';
                return (
                  <div key={tx.id} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <TxIcon
                        type={tx.type}
                        category={tx.category}
                        isDebt={tx.debt != null}
                        categoryIcons={categoryIcons}
                        className="h-8 w-8"
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {tx.debt
                            ? debtTxLabel(tx.type, tx.debt, tDebt)
                            : tx.category ? categoryName(tx.category, tCat) : (isIncome ? tc('income') : isTransfer ? tc('transfer') : tc('expense'))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isTransfer
                            ? <>{tx.wallet.name} ({tx.currency}) → {tx.toWallet?.name}{tx.toWallet ? ` (${tx.toWallet.currency})` : ''}</>
                            : <>{tx.wallet.name} ({tx.currency})</>}
                          {' • '}{formatDate(tx.date)}
                        </p>
                        {isTransfer && tx.description?.includes('Kurs:') && (
                          <p className="text-xs text-muted-foreground">
                            {tx.description.split(' | ').find(p => p.startsWith('Kurs:'))}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className={`text-right text-sm font-semibold ${
                        isIncome ? 'text-green-600' : isTransfer ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        <p>{isIncome ? '+' : '-'}{formatAmount(Number(tx.amount), tx.currency)}</p>
                        {isTransfer && tx.toAmount && tx.toCurrency && (
                          <p className="text-xs font-medium">+{formatAmount(Number(tx.toAmount), tx.toCurrency)}</p>
                        )}
                      </div>
                      <TransactionActions tx={tx} locale={locale} wallets={walletList} categories={categoryList} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
