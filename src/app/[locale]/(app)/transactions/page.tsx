import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { TransactionDialog } from '@/components/transactions/transaction-dialog';
import { TxIcon } from '@/components/transactions/tx-icon';
import { TransactionActions } from '@/components/transactions/transaction-actions';
import { debtTxLabel, openDebtOptions } from '@/lib/debt';
import { transactionWhere, transactionsHref, UNCATEGORIZED } from '@/lib/tx-filter';
import { CURRENCY_RANK } from '@/lib/currency';
import Link from 'next/link';
import { StickyHeader } from '@/components/sticky-header';
import { TransactionFilters } from '@/components/transactions/transaction-filters';
import { Pagination } from '@/components/transactions/pagination';
import { ExportButton } from '@/components/transactions/export-button';
import { ImportDialog } from '@/components/transactions/import-dialog';
import { Suspense } from 'react';
import { dayEnd, dayKey, dayLabel, dayStart, formatDay } from '@/lib/days';
import { balanceEffects } from '@/lib/balance';
import { walletOption } from '@/lib/credit';
import { processRecurring } from '@/lib/recurring-server';
import { getTranslations } from 'next-intl/server';
import { formatMoney, formatMoneySigned } from '@/lib/intl';
import { categoryName } from '@/lib/category-icons';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { deleteRecurring } from '@/lib/actions/transaction';
import { RecurringDialog, type EditableRecurring } from '@/components/transactions/recurring-dialog';
import { Repeat } from 'lucide-react';

const PAGE_SIZE = 20;


type SearchParams = { type?: string; walletId?: string; category?: string; from?: string; to?: string; page?: string };

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

  const t = await getTranslations('transactions');
  const tDebt = await getTranslations('debts');
  const tDays = await getTranslations('days');
  const tCat = await getTranslations('defaultCategories');
  const formatAmount = (amount: number, currency = 'UZS') => formatMoney(amount, currency, locale);

  const where = transactionWhere(user.id, filters);
  const hasFilters = Boolean(filters.type || filters.walletId || filters.category || filters.from || filters.to);

  const [transactions, total, wallets, categories, recurringRules, usedCategories, filteredSums, debtRows] = await Promise.all([
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
    // Kategoriya filtri uchun: haqiqatda ishlatilgan kategoriyalar (kirim/chiqim bo'yicha)
    prisma.transaction.groupBy({
      by: ['type', 'category'],
      where: { userId: user.id, type: { in: ['INCOME', 'EXPENSE'] } },
    }),
    // Filtr bo'yicha jami (o'tkazma va qarzlar kunlik jamidagidek kirmaydi)
    hasFilters
      ? prisma.transaction.groupBy({
          by: ['type', 'currency'],
          where: { AND: [where, { type: { in: ['INCOME', 'EXPENSE'] } }] },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
    // Tranzaksiya oynasidagi "Qaytarish" uchun
    prisma.debt.findMany({
      where: { userId: user.id },
      select: { id: true, type: true, person: true, currency: true, amount: true, transactions: { select: { type: true, amount: true } } },
    }),
  ]);

  const walletList = wallets.map(walletOption);
  const categoryList = categories.map(c => ({ id: c.id, name: c.name, icon: c.icon }));
  const categoryIcons = Object.fromEntries(categories.map(c => [c.name, c.icon]));

  // Filtrdagi kategoriya tanlovi: guruhlar Xarajat / Daromad, nomlari tarjima qilingan
  const categoryGroups = (['EXPENSE', 'INCOME'] as const).map((type) => {
    const rows = usedCategories.filter(r => r.type === type);
    return {
      label: t(type === 'INCOME' ? 'income' : 'expense'),
      options: [
        ...rows
          .filter(r => r.category)
          .map(r => ({ value: r.category!, label: categoryName(r.category!, tCat) }))
          .sort((a, b) => a.label.localeCompare(b.label, locale)),
        ...(rows.some(r => !r.category) ? [{ value: UNCATEGORIZED, label: t('uncategorized') }] : []),
      ],
    };
  }).filter(g => g.options.length > 0);

  // Filtr natijasi: valyuta bo'yicha kirim/chiqim jami, so'm birinchi
  const summary = Array.from(new Set(filteredSums.map(r => r.currency)))
    .sort((a, b) => (CURRENCY_RANK[a] ?? 9) - (CURRENCY_RANK[b] ?? 9))
    .map((currency) => {
      const sum = (type: string) => {
        const row = filteredSums.find(r => r.currency === currency && r.type === type);
        return row ? Number(row._sum.amount ?? 0) : null;
      };
      return { currency, income: sum('INCOME'), expense: sum('EXPENSE') };
    });

  // Tranzaksiyadagi kategoriya nomini bosish — joriy filtrlarga shu kategoriya qo'shiladi
  const categoryHref = (category: string) =>
    transactionsHref(locale, { type: filters.type, walletId: filters.walletId, from: filters.from, to: filters.to, category });

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
    for (const row of dayTxs) {
      const key = dayKey(row.date);
      if (!dayTotals.has(key)) dayTotals.set(key, { income: new Map(), expense: new Map() });
      const bucket = dayTotals.get(key)![row.type === 'INCOME' ? 'income' : 'expense'];
      bucket.set(row.currency, (bucket.get(row.currency) ?? 0) + Number(row.amount));
    }
  }

  // Kun oxiridagi qoldiq — hozirgi balansdan o'sha kundan keyingi barcha yozuvlar ta'sirini qaytarib hisoblanadi.
  // Hamyon tanlangan bo'lsa — faqat o'sha hamyon, aks holda barcha hamyonlar valyuta bo'yicha. Tur/sana filtrlari ta'sir qilmaydi.
  const scopeWallets = filters.walletId ? wallets.filter(w => w.id === filters.walletId) : wallets;
  const dayBalances = new Map<string, Map<string, number>>();
  if (groups.length > 0 && scopeWallets.length > 0) {
    const ids = scopeWallets.map(w => w.id);
    const later = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: { gte: dayEnd(groups.at(-1)!.key) },
        OR: [{ walletId: { in: ids } }, { toWalletId: { in: ids } }],
      },
      orderBy: { date: 'desc' },
      select: { type: true, walletId: true, toWalletId: true, amount: true, toAmount: true, date: true },
    });
    const running = new Map(scopeWallets.map(w => [w.id, Number(w.balance)]));
    let i = 0;
    for (const { key } of groups) {
      const end = dayEnd(key);
      for (; i < later.length && later[i].date >= end; i++) {
        for (const e of balanceEffects(later[i])) {
          if (running.has(e.walletId)) running.set(e.walletId, running.get(e.walletId)! - e.delta);
        }
      }
      const byCurrency = new Map<string, number>();
      for (const w of scopeWallets) {
        byCurrency.set(w.currency, (byCurrency.get(w.currency) ?? 0) + running.get(w.id)!);
      }
      dayBalances.set(key, byCurrency);
    }
  }

  function renderRow(tx: (typeof transactions)[number]) {
    const isIncome = tx.type === 'INCOME' || tx.type === 'DEBT_IN';
    const isTransfer = tx.type === 'TRANSFER';
    // Tanlangan hamyonga kelgan o'tkazma — shu hamyon nuqtai nazaridan kirim sifatida ko'rsatiladi
    const isIncomingTransfer = isTransfer && filters.walletId != null && tx.toWalletId === filters.walletId;

    return (
      <div key={tx.id} className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <TxIcon type={tx.type} category={tx.category} isDebt={tx.debt != null} categoryIcons={categoryIcons} />
          <div>
            <p className="text-sm font-medium">
              {tx.debt
                ? debtTxLabel(tx.type, tx.debt, tDebt)
                : tx.category
                  ? (
                    <Link
                      href={categoryHref(tx.category)}
                      className="underline-offset-2 hover:underline"
                      title={t('filterByCategory')}
                    >
                      {categoryName(tx.category, tCat)}
                    </Link>
                  )
                  : t(isIncome ? 'income' : isTransfer ? 'transfer' : 'expense')}
            </p>
            <p className="text-xs text-muted-foreground">
              {isTransfer
                ? `${tx.wallet.name} (${tx.currency}) → ${tx.toWallet?.name}${tx.toWallet ? ` (${tx.toWallet.currency})` : ''}`
                : `${tx.wallet.name} (${tx.currency})`}
              {tx.description && !isTransfer && ` • ${tx.description}`}
              {tx.recurringId && (
                <Repeat className="ml-1.5 inline h-3 w-3 align-[-2px]" aria-label={t('recurringMark')} />
              )}
            </p>
            {isTransfer && (tx.rate || tx.description?.includes('Kurs:')) && (
              <p className="text-xs text-muted-foreground">
                {tx.rate
                  ? t('rateValue', { rate: Number(tx.rate) })
                  : tx.description?.split(' | ').find(p => p.startsWith('Kurs:'))}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`text-right text-sm font-semibold ${
            isIncome ? 'text-green-600' : isTransfer ? 'text-blue-600' : 'text-red-600'
          }`}>
            {isIncomingTransfer ? (
              <p>+{formatAmount(Number(tx.toAmount ?? tx.amount), tx.toCurrency ?? tx.currency)}</p>
            ) : (
              <p>{isIncome ? '+' : '-'}{formatAmount(Number(tx.amount), tx.currency)}</p>
            )}
            {isTransfer && !isIncomingTransfer && tx.toAmount && tx.toCurrency && (
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
      {/* Sarlavha, tugmalar, filtrlar va natija jami aylantirganda tepada qotib turadi */}
      <StickyHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <div className="flex items-center gap-2">
            <ImportDialog locale={locale} />
            <ExportButton locale={locale} filters={filters} />
            <TransactionDialog wallets={walletList} savedCategories={categoryList} openDebts={openDebtOptions(debtRows)} />
          </div>
        </div>

        <Suspense>
          <TransactionFilters wallets={walletList} categoryGroups={categoryGroups} />
        </Suspense>

        {/* Filtr natijasi: nechta yozuv va kirim/chiqim jami */}
        {hasFilters && total > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-4 py-2 text-sm">
            <span className="text-muted-foreground">{t('filteredCount', { count: total })}</span>
            {summary.map(({ currency, income, expense }) => (
              <span key={currency} className="flex flex-wrap gap-x-3 font-semibold tabular-nums">
                {income != null && <span className="text-green-600">+{formatAmount(income, currency)}</span>}
                {expense != null && <span className="text-red-600">-{formatAmount(expense, currency)}</span>}
              </span>
            ))}
          </div>
        )}
      </StickyHeader>

      {recurringRules.length > 0 && (
        <Card>
          <details>
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              {t('recurringList', { count: recurringRules.length })}
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
                          {r.category ? categoryName(r.category, tCat) : t(isIncome ? 'income' : 'expense')}
                          {r.description && <span className="font-normal text-muted-foreground"> • {r.description}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(`freq.${r.frequency}`)} • {r.wallet.name} • {t('nextOn', { date: formatDay(r.nextDate, locale) })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className={`text-sm font-semibold tabular-nums ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                        {isIncome ? '+' : '-'}{formatAmount(Number(r.amount), r.currency)}
                      </span>
                      <RecurringDialog
                        wallets={walletList}
                        savedCategories={categoryList}
                        rule={{
                          id: r.id,
                          type: r.type as EditableRecurring['type'],
                          walletId: r.walletId,
                          amount: Number(r.amount),
                          category: r.category,
                          description: r.description,
                          frequency: r.frequency,
                          nextDate: dayKey(r.nextDate),
                        }}
                      />
                      <ConfirmDeleteButton
                        id={r.id}
                        action={deleteRecurring}
                        title={t('stopRecurringTitle')}
                        description={t('stopRecurringDescription')}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        </Card>
      )}


      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              {Object.values(filters).some(Boolean)
                ? t('noMatches')
                : t('empty')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
        <Card>
          <CardContent className="p-0">
            {groups.map(({ key, items }) => {
              const totals = dayTotals.get(key);
              const balances = dayBalances.get(key);
              return (
                <section key={key} className="border-b last:border-b-0">
                  {/* Kun sarlavhasi: chapda sana va kun oxiridagi qoldiq, o'ngda kunlik jami */}
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-b bg-muted/50 px-4 py-1.5 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-muted-foreground">{dayLabel(key, tDays, locale)}</span>
                      {balances && (
                        <span className="tabular-nums text-muted-foreground">
                          {t('dayBalance')}:{' '}
                          <span className="font-semibold text-foreground">
                            {Array.from(balances, ([cur, amount]) => formatMoneySigned(amount, cur, locale)).join(' · ')}
                          </span>
                        </span>
                      )}
                    </div>
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
