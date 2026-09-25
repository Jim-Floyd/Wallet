import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Wallet, CreditCard, HandCoins } from 'lucide-react';
import { debtProgress, debtTxLabel } from '@/lib/debt';
import { dueInfo } from '@/lib/days';
import { processRecurring } from '@/lib/recurring-server';
import { WalletAvatar } from '@/components/wallets/wallet-avatar';
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

function formatAmount(amount: number, currency = 'UZS') {
  const formatted = new Intl.NumberFormat('uz-UZ').format(Math.abs(amount));
  return `${formatted} ${currency}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('dashboard');
  const tc = await getTranslations('transactions');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth/login`);
  await processRecurring(user.id);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [wallets, categories, monthlyStats, recentTransactions, debtRows] = await Promise.all([
    prisma.wallet.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId: user.id,
        date: { gte: startOfMonth },
        type: { in: ['INCOME', 'EXPENSE'] },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
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
  ]);

  const walletList = wallets.map(w => ({ id: w.id, name: w.name, currency: w.currency }));
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

  const totalBalanceUZS = wallets
    .filter(w => w.currency === 'UZS')
    .reduce((sum, w) => sum + Number(w.balance), 0);

  const otherCurrencies = wallets
    .filter(w => w.currency !== 'UZS')
    .reduce<Record<string, number>>((acc, w) => {
      acc[w.currency] = (acc[w.currency] ?? 0) + Number(w.balance);
      return acc;
    }, {});
  const monthlyIncome = Number(monthlyStats.find(s => s.type === 'INCOME')?._sum.amount ?? 0);
  const monthlyExpense = Number(monthlyStats.find(s => s.type === 'EXPENSE')?._sum.amount ?? 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

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
            <div className="text-2xl font-bold">{formatAmount(totalBalanceUZS, 'UZS')}</div>
            {Object.entries(otherCurrencies).map(([cur, bal]) => (
              <div key={cur} className="text-sm font-medium text-muted-foreground">
                + {formatAmount(bal, cur)}
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-1">{wallets.length} ta hamyon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('monthlyIncome')}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">+{formatAmount(monthlyIncome)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Intl.DateTimeFormat('uz-UZ', { month: 'long' }).format(now)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('monthlyExpense')}
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">-{formatAmount(monthlyExpense)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Intl.DateTimeFormat('uz-UZ', { month: 'long' }).format(now)}
            </p>
          </CardContent>
        </Card>
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
          </CardHeader>
          <CardContent className="space-y-3">
            {wallets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noWallets')}</p>
            ) : (
              wallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <WalletAvatar icon={wallet.icon} color={wallet.color} currency={wallet.currency} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{wallet.name} <span className="text-muted-foreground font-normal">({wallet.currency})</span></p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatAmount(Number(wallet.balance), wallet.currency)}</p>
                      {wallet.isDefault && (
                        <p className="text-xs text-primary">Asosiy</p>
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
                      }}
                    />
                    {wallet.isDefault ? (
                      // O'chirish tugmasi o'rnini egallab turadi — qatorlar tekis bo'lishi uchun
                      <span className="h-7 w-7" />
                    ) : (
                      <ConfirmDeleteButton
                        id={wallet.id}
                        action={deleteWallet}
                        title="Hamyonni o'chirish"
                        description={`"${wallet.name}" hamyoni va undagi barcha kirim/chiqim yozuvlari o'chiriladi. Bu amalni qaytarib bo'lmaydi.`}
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
                Qarzlar
              </span>
              <Link href={`/${locale}/debts`} className="text-xs font-normal text-muted-foreground hover:text-foreground">
                Barchasi →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openDebts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ochiq qarz yo&apos;q</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-green-50 p-2 dark:bg-green-950/30">
                    <p className="text-xs text-muted-foreground">Menga qarzdor</p>
                    {owedToMe.length === 0
                      ? <p className="font-semibold text-muted-foreground">0</p>
                      : owedToMe.map(([cur, v]) => (
                        <p key={cur} className="font-semibold text-green-600">{formatAmount(v, cur)}</p>
                      ))}
                  </div>
                  <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950/30">
                    <p className="text-xs text-muted-foreground">Mening qarzim</p>
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
                    const due = d.dueDate ? dueInfo(d.dueDate) : null;
                    return (
                      <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{d.person}</p>
                          <p className={`text-xs ${
                            due?.tone === 'overdue' ? 'font-medium text-red-600'
                              : due?.tone === 'soon' ? 'font-medium text-amber-600'
                              : 'text-muted-foreground'
                          }`}>
                            {due ? due.text : 'Muddatsiz'}
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
                    Yana {openDebts.length - upcomingDebts.length} ta qarz →
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
                            ? debtTxLabel(tx.type, tx.debt)
                            : tx.category ?? (isIncome ? tc('income') : isTransfer ? tc('transfer') : tc('expense'))}
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
