import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight } from 'lucide-react';
import { AddTransactionDialog } from '@/components/dashboard/add-transaction-dialog';
import { TransactionFilters } from '@/components/transactions/transaction-filters';
import { Pagination } from '@/components/transactions/pagination';
import { ExportButton } from '@/components/transactions/export-button';
import { Suspense } from 'react';

const PAGE_SIZE = 20;

function formatAmount(amount: number, currency = 'UZS') {
  return `${new Intl.NumberFormat('uz-UZ').format(Math.abs(amount))} ${currency}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

type SearchParams = { type?: string; walletId?: string; from?: string; to?: string; page?: string };

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  const page = Math.max(1, parseInt(filters.page ?? '1'));
  const skip = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const where = {
    userId: user.id,
    ...(filters.type && { type: filters.type as 'INCOME' | 'EXPENSE' | 'TRANSFER' }),
    ...(filters.walletId && { walletId: filters.walletId }),
    ...((filters.from || filters.to) && {
      date: {
        ...(filters.from && { gte: new Date(filters.from) }),
        ...(filters.to && { lte: new Date(filters.to + 'T23:59:59') }),
      },
    }),
  };

  const [transactions, total, wallets, categories] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: PAGE_SIZE,
      include: {
        wallet: { select: { name: true, currency: true } },
        toWallet: { select: { name: true, currency: true } },
      },
    }),
    prisma.transaction.count({ where }),
    prisma.wallet.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const walletList = wallets.map(w => ({ id: w.id, name: w.name, currency: w.currency }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tranzaksiyalar</h1>
        <div className="flex items-center gap-2">
          <ExportButton locale={locale} filters={filters} />
          <AddTransactionDialog
            wallets={walletList}
            savedCategories={categories.map(c => ({ id: c.id, name: c.name }))}
          />
        </div>
      </div>

      <Suspense>
        <TransactionFilters wallets={walletList} />
      </Suspense>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              {Object.values(filters).some(Boolean)
                ? 'Bu filtrlarga mos tranzaksiya topilmadi'
                : 'Hali tranzaksiya mavjud emas'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
        <Card>
          <CardContent className="divide-y p-0">
            {transactions.map((tx) => {
              const isIncome = tx.type === 'INCOME';
              const isTransfer = tx.type === 'TRANSFER';

              return (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      isIncome ? 'bg-green-100' : isTransfer ? 'bg-blue-100' : 'bg-red-100'
                    }`}>
                      {isIncome
                        ? <ArrowUpRight className="h-4 w-4 text-green-600" />
                        : isTransfer
                        ? <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                        : <ArrowDownRight className="h-4 w-4 text-red-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {tx.category ?? (isIncome ? 'Daromad' : isTransfer ? "O'tkazma" : 'Xarajat')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isTransfer
                          ? `${tx.wallet.name} (${tx.currency}) → ${tx.toWallet?.name}${tx.toWallet ? ` (${tx.toWallet.currency})` : ''}`
                          : `${tx.wallet.name} (${tx.currency})`}
                        {' • '}{formatDate(tx.date)}
                      </p>
                      {isTransfer && (tx.rate || tx.description?.includes('Kurs:')) && (
                        <p className="text-xs text-muted-foreground">
                          {tx.rate
                            ? `Kurs: ${Number(tx.rate)}`
                            : tx.description?.split(' | ').find(p => p.startsWith('Kurs:'))}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={`text-right text-sm font-semibold ${
                    isIncome ? 'text-green-600' : isTransfer ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    <p>{isIncome ? '+' : '-'}{formatAmount(Number(tx.amount), tx.currency)}</p>
                    {isTransfer && tx.toAmount && tx.toCurrency && (
                      <p className="text-xs font-medium">+{formatAmount(Number(tx.toAmount), tx.toCurrency)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Suspense>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} />
        </Suspense>
        </>
      )}
    </div>
  );
}
