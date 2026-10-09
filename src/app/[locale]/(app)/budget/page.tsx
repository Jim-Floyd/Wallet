import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { processRecurring } from '@/lib/recurring-server';
import { getTranslations } from 'next-intl/server';
import { formatMoney } from '@/lib/intl';
import { categoryName, EXPENSE_DEFAULTS, INCOME_DEFAULTS } from '@/lib/category-icons';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthNav } from '@/components/month-nav';
import { BudgetDialog } from '@/components/budget/budget-dialog';
import { deleteBudgetAction } from '@/lib/actions/budget';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { StickyHeader } from '@/components/sticky-header';
import { BudgetHistoryChart, type BudgetMonth } from '@/components/budget/budget-history-chart';
import { dayKey, monthStart, parseMonthParams } from '@/lib/days';
import { transactionsHref } from '@/lib/tx-filter';


type SearchParams = { month?: string; year?: string };

export default async function BudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const { month, year } = parseMonthParams(sp);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  await processRecurring(user.id);
  const t = await getTranslations('budget');
  const tCat = await getTranslations('defaultCategories');
  const tMonths = await getTranslations('months');
  const formatAmount = (n: number, currency: string) => formatMoney(n, currency, locale);

  // Oy Toshkent vaqti bo'yicha — Tranzaksiyalar filtridagi jami bilan bir xil chiqishi uchun
  const start = monthStart(year, month);
  const end = monthStart(year, month + 1);
  const spentHref = (category: string) => transactionsHref(locale, {
    type: 'EXPENSE', category, from: dayKey(start), to: dayKey(new Date(end.getTime() - 1)),
  });

  // Byudjet tarixi: tanlangan oy bilan oxirgi 6 oy
  const HISTORY = 6;
  const historyMonths = Array.from({ length: HISTORY }, (_, i) => {
    const s = monthStart(year, month - HISTORY + 1 + i);
    const [y, m] = dayKey(s).split('-').map(Number);
    return { start: s, end: monthStart(year, month - HISTORY + 2 + i), y, m };
  });

  const [budgets, txs, categories, usedCategories, historyBudgets, historyTxs] = await Promise.all([
    prisma.budget.findMany({
      where: { userId: user.id, month, year },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: 'EXPENSE',
        date: { gte: start, lt: end },
        category: { not: null },
      },
      select: { category: true, amount: true, currency: true },
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    }),
    prisma.transaction.groupBy({
      by: ['type', 'category'],
      where: { userId: user.id, type: { in: ['INCOME', 'EXPENSE'] }, category: { not: null } },
    }),
    prisma.budget.findMany({
      where: { userId: user.id, OR: historyMonths.map(h => ({ month: h.m, year: h.y })) },
      select: { category: true, amount: true, currency: true, month: true, year: true },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: 'EXPENSE', category: { not: null }, date: { gte: historyMonths[0].start, lt: end } },
      select: { category: true, amount: true, currency: true, date: true },
    }),
  ]);

  // Har oy: shu oy byudjet qo'yilgan kategoriyalardagi xarajat va limitlar yig'indisi (valyuta bo'yicha).
  // Grafik kamida 2 oyda byudjet bo'lsa chiqadi — bitta ustunli grafik ma'nosiz
  const historyByCurrency = Array.from(new Set(historyBudgets.map(b => b.currency))).map((cur) => {
    const data: BudgetMonth[] = historyMonths.map((h) => {
      const monthBudgets = historyBudgets.filter(b => b.currency === cur && b.month === h.m && b.year === h.y);
      const cats = new Set(monthBudgets.map(b => b.category));
      const spent = historyTxs
        .filter(x => x.currency === cur && x.date >= h.start && x.date < h.end && cats.has(x.category!))
        .reduce((s, x) => s + Number(x.amount), 0);
      const name = tMonths(`m${h.m}`);
      return {
        key: `${h.y}-${h.m}`,
        label: name.slice(0, 3),
        full: `${name} ${h.y}`,
        spent,
        limit: monthBudgets.length > 0 ? monthBudgets.reduce((s, b) => s + Number(b.amount), 0) : null,
      };
    });
    return { currency: cur, data };
  }).filter(h => h.data.filter(d => d.limit != null).length >= 2);

  // category::currency → spent amount
  const spentMap = new Map<string, number>();
  for (const tx of txs) {
    if (!tx.category) continue;
    const key = `${tx.category}::${tx.currency}`;
    spentMap.set(key, (spentMap.get(key) ?? 0) + Number(tx.amount));
  }

  // Byudjet faqat xarajatga: standart xarajat kategoriyalari + o'zingizniki + xarajatda ishlatilganlar.
  // Category'da tur saqlanmaydi — faqat daromadda ishlatilgan (va standart daromad) kategoriyalar chiqarib tashlanadi
  const usedIn = (type: 'INCOME' | 'EXPENSE') =>
    new Set(usedCategories.filter(r => r.type === type).map(r => r.category!));
  const expenseUsed = usedIn('EXPENSE');
  const incomeUsed = usedIn('INCOME');
  const isIncomeOnly = (name: string) =>
    !EXPENSE_DEFAULTS.includes(name) && !expenseUsed.has(name) && (incomeUsed.has(name) || INCOME_DEFAULTS.includes(name));
  const categoryNames = Array.from(new Set([...EXPENSE_DEFAULTS, ...categories.map(c => c.name), ...Array.from(expenseUsed)]))
    .filter(name => !isIncomeOnly(name))
    .sort((a, b) => categoryName(a, tCat).localeCompare(categoryName(b, tCat), locale));

  // Davrga nisbatan sur'at: oyning qancha qismi o'tdi va shu sur'atda oy oxiriga qancha bo'ladi (faqat joriy oy).
  // Prognoz oyning kamida 10% o'tgach — boshida bitta xarid butun oyga noto'g'ri ko'paytiriladi
  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;
  const isCurrent = now >= start && now < end;
  const elapsed = isCurrent ? (now.getTime() - start.getTime()) / (end.getTime() - start.getTime()) : 0;
  const daysLeft = isCurrent ? Math.ceil((end.getTime() - now.getTime()) / DAY) : 0;
  const pace = (spent: number, limit: number) => {
    const projected = isCurrent && elapsed >= 0.1 ? spent / elapsed : null;
    return {
      spentPct: limit > 0 ? (spent / limit) * 100 : 0,
      projected,
      fast: projected != null && projected > limit,
      daily: isCurrent && limit > spent ? (limit - spent) / daysLeft : null,
    };
  };

  // Jami byudjet valyuta bo'yicha (faqat byudjet qo'yilgan kategoriyalar)
  const totals = new Map<string, { limit: number; spent: number }>();
  for (const b of budgets) {
    const s = totals.get(b.currency) ?? { limit: 0, spent: 0 };
    s.limit += Number(b.amount);
    s.spent += spentMap.get(`${b.category}::${b.currency}`) ?? 0;
    totals.set(b.currency, s);
  }

  // Progress chizig'i: sarflangan ulush + joriy oyda "bugun" belgisi; ostida sur'at, prognoz va kunlik me'yor
  const progress = (spent: number, limit: number, currency: string) => {
    const p = pace(spent, limit);
    const over = spent > limit;
    const barColor = over
      ? 'bg-red-500'
      : isCurrent
        ? (p.fast ? 'bg-amber-400' : 'bg-green-500')
        : p.spentPct >= 75 ? 'bg-amber-400' : 'bg-green-500';
    return (
      <div className="space-y-1.5">
        <div className="relative">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(p.spentPct, 100)}%` }} />
          </div>
          {isCurrent && (
            <div
              className="absolute -top-1 -bottom-1 w-0.5 rounded bg-foreground/70"
              style={{ left: `${elapsed * 100}%` }}
              title={t('today')}
            />
          )}
        </div>
        {isCurrent && (
          <div className="space-y-0.5 text-xs">
            <p className="text-muted-foreground">
              {t('monthElapsed', { pct: Math.round(elapsed * 100) })} · {t('spentShare', { pct: Math.round(p.spentPct) })}
            </p>
            {!over && p.projected != null && (
              <p className={p.fast ? 'font-medium text-amber-600' : 'text-green-700 dark:text-green-400'}>
                {p.fast
                  ? t('forecastOver', { amount: formatAmount(p.projected, currency), over: formatAmount(p.projected - limit, currency) })
                  : t('forecastOk', { amount: formatAmount(p.projected, currency) })}
              </p>
            )}
            {p.daily != null && (
              <p className="text-muted-foreground">{t('dailyAllowance', { days: daysLeft, amount: formatAmount(p.daily, currency) })}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <StickyHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <BudgetDialog month={month} year={year} categories={categoryNames} />
        </div>

        <Suspense>
          <MonthNav month={month} year={year} />
        </Suspense>

        {/* Jami byudjet (valyuta bo'yicha) — sarlavha bilan birga qotib turadi */}
        {Array.from(totals).map(([cur, s]) => (
          <div key={cur} className="space-y-2 rounded-lg border bg-muted/40 px-4 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="font-semibold">{t('totalBudget')}{totals.size > 1 ? ` (${cur})` : ''}</span>
              <span className={`tabular-nums ${s.spent > s.limit ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                {formatAmount(s.spent, cur)} / {formatAmount(s.limit, cur)}
                {' · '}{s.limit > 0 ? Math.round((s.spent / s.limit) * 100) : 0}%
              </span>
            </div>
            {progress(s.spent, s.limit, cur)}
          </div>
        ))}
      </StickyHeader>

      {budgets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const spent = spentMap.get(`${b.category}::${b.currency}`) ?? 0;
            const limit = Number(b.amount);
            const over = spent > limit;

            return (
              <Card key={b.id}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={spentHref(b.category)}
                        className="font-semibold underline-offset-2 hover:underline"
                        title={t('showExpenses')}
                      >
                        {categoryName(b.category, tCat)}
                      </Link>
                      <p className={`text-sm ${over ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {formatAmount(spent, b.currency)}
                        {' / '}
                        {formatAmount(limit, b.currency)}
                        {over && ` — ${t('overLimit')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className={`text-sm font-bold ${over ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {Math.round((spent / limit) * 100)}%
                      </span>
                      <BudgetDialog
                        month={month}
                        year={year}
                        categories={categoryNames}
                        budget={{ id: b.id, category: b.category, amount: limit, currency: b.currency }}
                      />
                      <form>
                        <input type="hidden" name="id" value={b.id} />
                        <Button
                          formAction={deleteBudgetAction}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>

                  {progress(spent, limit, b.currency)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Byudjet tarixi: oxirgi 6 oy — sarflangan va limit */}
      {historyByCurrency.map((h) => (
        <Card key={h.currency}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('historyTitle')}{historyByCurrency.length > 1 ? ` (${h.currency})` : ''}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('historySubtitle')}</p>
          </CardHeader>
          <CardContent>
            <BudgetHistoryChart
              data={h.data}
              currency={h.currency}
              locale={locale}
              labels={{ spent: t('spent'), limit: t('limit'), over: t('overLimitMonth'), chartLabel: t('historyTitle') }}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
