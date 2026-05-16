import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, CreditCard, ArrowUpRight, ArrowDownRight, ArrowLeftRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { AddWalletDialog } from '@/components/dashboard/add-wallet-dialog';
import { AddTransactionDialog } from '@/components/dashboard/add-transaction-dialog';

function formatAmount(amount: number, currency = 'UZS') {
  const formatted = new Intl.NumberFormat('uz-UZ').format(Math.abs(amount));
  return `${formatted} ${currency}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

const currencyColors: Record<string, string> = {
  UZS: 'bg-emerald-500',
  USD: 'bg-blue-500',
  EUR: 'bg-indigo-500',
  RUB: 'bg-red-500',
};

const currencyFlags: Record<string, string> = {
  UZS: '🇺🇿',
  USD: '🇺🇸',
  EUR: '🇪🇺',
  RUB: '🇷🇺',
};

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('dashboard');
  const tc = await getTranslations('transactions');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth/login`);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [wallets, categories, monthlyStats, recentTransactions] = await Promise.all([
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
      include: { wallet: { select: { name: true, currency: true } }, toWallet: { select: { name: true, currency: true } } },
    }),
  ]);

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

      <div className="grid gap-4 md:grid-cols-2">
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
                <div key={wallet.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-lg ${!wallet.color ? (currencyColors[wallet.currency] ?? 'bg-gray-500') : ''}`}
                      style={wallet.color ? { backgroundColor: wallet.color } : undefined}
                    >
                      {currencyFlags[wallet.currency] ?? '💳'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{wallet.name} <span className="text-muted-foreground font-normal">({wallet.currency})</span></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatAmount(Number(wallet.balance), wallet.currency)}</p>
                    {wallet.isDefault && (
                      <p className="text-xs text-primary">Asosiy</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t('recentTransactions')}</span>
              <AddTransactionDialog
                wallets={wallets.map(w => ({ id: w.id, name: w.name, currency: w.currency }))}
                savedCategories={categories.map(c => ({ id: c.id, name: c.name }))}
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noTransactions')}</p>
            ) : (
              recentTransactions.map((tx) => {
                const isIncome = tx.type === 'INCOME';
                const isTransfer = tx.type === 'TRANSFER';
                return (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isIncome ? 'bg-green-100' : isTransfer ? 'bg-blue-100' : 'bg-red-100'
                      }`}>
                        {isIncome ? (
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                        ) : isTransfer ? (
                          <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.category ?? (isIncome ? tc('income') : isTransfer ? tc('transfer') : tc('expense'))}</p>
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
                    <div className={`text-right text-sm font-semibold ${
                      isIncome ? 'text-green-600' : isTransfer ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      <p>{isIncome ? '+' : isTransfer ? '-' : '-'}{formatAmount(Number(tx.amount), tx.currency)}</p>
                      {isTransfer && tx.toAmount && tx.toCurrency && (
                        <p className="text-xs font-medium">+{formatAmount(Number(tx.toAmount), tx.toCurrency)}</p>
                      )}
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
