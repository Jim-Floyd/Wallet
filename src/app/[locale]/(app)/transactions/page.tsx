import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { TransactionDialog } from '@/components/transactions/transaction-dialog';
import { TxIcon } from '@/components/transactions/tx-icon';
import { TransactionActions } from '@/components/transactions/transaction-actions';
import { debtTxLabel, txTypeWhere } from '@/lib/debt';
import { TransactionFilters } from '@/components/transactions/transaction-filters';
import { Pagination } from '@/components/transactions/pagination';
import { ExportButton } from '@/components/transactions/export-button';
import { Suspense } from 'react';
import { APP_TZ, dayEnd, dayKey, dayLabel, dayStart } from '@/lib/days';
import { processRecurring } from '@/lib/recurring-server';
import { frequencyLabel } from '@/lib/recurring';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { deleteRecurring } from '@/lib/actions/transaction';
import { Repeat } from 'lucide-react';

function formatDay(date: Date) {
  return new Intl.DateTimeFormat('uz-UZ', { timeZone: APP_TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

const PAGE_SIZE = 20;

function formatAmount(amount: number, currency = 'UZS') {
  return `${new Intl.NumberFormat('uz-UZ').format(Math.abs(amount))} ${currency}`;
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
  await processRecurring(user.id);

  const where = {
    userId: user.id,
    ...txTypeWhere(filters.type),
    ...(filters.walletId && { walletId: filters.walletId }),
    ...((filters.from || filters.to) && {
      date: {
        ...(filters.from && { gte: new Date(filters.from) }),
        ...(filters.to && { lte: new Date(filters.to + 'T23:59:59') }),
      },
    }),
  };

  const [transactions, total, wallets, categories, recurringRules] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: PAGE_SIZE,
      include: {
        wallet: { select: { name: true, currency: true } },
        toWallet: { select: { name: true, currency: true } },
        debt: { select: { type: true, person: true } },
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
    prisma.recurringRule.findMany({
      where: { userId: user.id },
      orderBy: { nextDate: 'asc' },
      include: { wallet: { select: { name: true } } },
    }),
  ]);

  const walletList = wallets.map(w => ({ id: w.id, name: w.name, currency: w.currency }));
  const categoryList = categories.map(c => ({ id: c.id, name: c.name, icon: c.icon }));
  const categoryIcons = Object.fromEntries(categories.map(c => [c.name, c.icon]));

  // Kunlar bo'yicha guruhlash (tranzaksiyalar sana bo'yicha kamayish tartibida)
  const groups: { key: string; items: typeof transactions }[] = [];
  for (const tx of transactions) {
    const key = dayKey(tx.date);
    if (groups.at(-1)?.key === key) groups.at(-1)!.items.push(tx);
    else groups.push({ key, items: [tx] });
  }

  // Kunlik jami — sahifadagi kunlarning BUTUN kuni bo'yicha (kun sahifalarga bo'linib qolsa ham), filtrlar bilan.
  // Faqat kirim/chiqim: o'tkazma va qarzlar oylik statistikadagidek hisobga olinmaydi.
  const dayTotals = new Map<string, { income: Map<string, number>; expense: Map<string, number> }>();
  if (groups.length > 0) {
    const dayTxs = await prisma.transaction.findMany({
      where: {
        AND: [
          where,
          { type: { in: ['INCOME', 'EXPENSE'] } },
          { date: { gte: dayStart(groups.at(-1)!.key), lt: dayEnd(groups[0].key) } },
        ],
      },
      select: { type: true, amount: true, currency: true, date: true },
    });
    for (const t of dayTxs) {
      const key = dayKey(t.date);
      if (!dayTotals.has(key)) dayTotals.set(key, { income: new Map(), expense: new Map() });
      const bucket = dayTotals.get(key)![t.type === 'INCOME' ? 'income' : 'expense'];
      bucket.set(t.currency, (bucket.get(t.currency) ?? 0) + Number(t.amount));
    }
  }

  function renderRow(tx: (typeof transactions)[number]) {
    const isIncome = tx.type === 'INCOME' || tx.type === 'DEBT_IN';
    const isTransfer = tx.type === 'TRANSFER';

    return (
      <div key={tx.id} className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <TxIcon type={tx.type} category={tx.category} isDebt={tx.debt != null} categoryIcons={categoryIcons} />
          <div>
            <p className="text-sm font-medium">
              {tx.debt
                ? debtTxLabel(tx.type, tx.debt)
                : tx.category ?? (isIncome ? 'Daromad' : isTransfer ? "O'tkazma" : 'Xarajat')}
            </p>
            <p className="text-xs text-muted-foreground">
              {isTransfer
                ? `${tx.wallet.name} (${tx.currency}) → ${tx.toWallet?.name}${tx.toWallet ? ` (${tx.toWallet.currency})` : ''}`
                : `${tx.wallet.name} (${tx.currency})`}
              {tx.description && !isTransfer && ` • ${tx.description}`}
              {tx.recurringId && (
                <Repeat className="ml-1.5 inline h-3 w-3 align-[-2px]" aria-label="Takrorlanuvchi" />
              )}
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

        <div className="flex items-center gap-2">
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
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tranzaksiyalar</h1>
        <div className="flex items-center gap-2">
          <ExportButton locale={locale} filters={filters} />
          <TransactionDialog wallets={walletList} savedCategories={categoryList} />
        </div>
      </div>

      {recurringRules.length > 0 && (
        <Card>
          <details>
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              Takrorlanuvchi to&apos;lovlar ({recurringRules.length})
            </summary>
            <div className="divide-y border-t">
              {recurringRules.map((r) => {
                const isIncome = r.type === 'INCOME';
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <TxIcon type={r.type} category={r.category} isDebt={false} categoryIcons={categoryIcons} className="h-8 w-8" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {r.category ?? (isIncome ? 'Daromad' : 'Xarajat')}
                          {r.description && <span className="font-normal text-muted-foreground"> • {r.description}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {frequencyLabel(r.frequency)} • {r.wallet.name} • Keyingisi: {formatDay(r.nextDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className={`text-sm font-semibold tabular-nums ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                        {isIncome ? '+' : '-'}{formatAmount(Number(r.amount), r.currency)}
                      </span>
                      <ConfirmDeleteButton
                        id={r.id}
                        action={deleteRecurring}
                        title="Takrorni to'xtatish"
                        description="Bundan keyin yangi yozuvlar avtomatik qo'shilmaydi. Oldin qo'shilgan yozuvlar saqlanib qoladi."
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        </Card>
      )}

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
          <CardContent className="p-0">
            {groups.map(({ key, items }) => {
              const totals = dayTotals.get(key);
              return (
                <section key={key} className="border-b last:border-b-0">
                  {/* Kun sarlavhasi: chapda sana, o'ngda kunlik jami */}
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-b bg-muted/50 px-4 py-1.5 text-xs">
                    <span className="font-semibold text-muted-foreground">{dayLabel(key)}</span>
                    {totals && (
                      <div className="flex flex-col items-end gap-0.5 font-semibold tabular-nums">
                        {Array.from(new Set(Array.from(totals.income.keys()).concat(Array.from(totals.expense.keys())))).map((cur) => {
                          const income = totals.income.get(cur);
                          const expense = totals.expense.get(cur);
                          // Sof natija faqat kirim ham, chiqim ham bo'lgan kunda — aks holda takror bo'ladi
                          const net = income != null && expense != null ? income - expense : null;
                          return (
                            <div key={cur} className="flex flex-wrap justify-end gap-x-3">
                              {income != null && <span className="text-green-600">+{formatAmount(income, cur)}</span>}
                              {expense != null && <span className="text-red-600">-{formatAmount(expense, cur)}</span>}
                              {net != null && (
                                <span className={net >= 0 ? 'text-green-700' : 'text-red-700'}>
                                  = {net >= 0 ? '+' : '-'}{formatAmount(net, cur)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="divide-y">{items.map(renderRow)}</div>
                </section>
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
