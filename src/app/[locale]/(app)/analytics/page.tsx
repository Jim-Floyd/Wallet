import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { processRecurring } from '@/lib/recurring-server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StickyHeader } from '@/components/sticky-header';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';
import { IncomeExpenseChart, type MonthPoint } from '@/components/analytics/income-expense-chart';
import { CategoryBreakdown, type DonutSegment } from '@/components/analytics/category-donut';
import { SimpleBarChart, type BarPoint } from '@/components/analytics/simple-bar-chart';
import { BalanceChart, type BalancePoint } from '@/components/analytics/balance-chart';
import { parsePeriod } from '@/lib/analytics';
import { balanceEffects } from '@/lib/balance';
import { categoryName } from '@/lib/category-icons';
import { CURRENCY_RANK } from '@/lib/currency';
import { dayEnd, dayKey, dayStart, formatDay, monthStart } from '@/lib/days';
import { formatMoney, formatMoneySigned } from '@/lib/intl';
import { transactionsHref, UNCATEGORIZED } from '@/lib/tx-filter';

// Kategoriya ranglari: qat'iy tartibdagi 5 slot (globals.css --viz-cat-N), qolgani — "Boshqa" kulrang
const CATEGORY_SLOTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

type Delta = { text: string; dir: 'up' | 'down' | 'flat'; good: boolean | null } | null;

// "YYYY-MM-DD" kunlari ketma-ket (Toshkent kuni)
function dayKeys(fromKey: string, toKey: string) {
  const keys: string[] = [];
  for (let d = dayStart(fromKey); dayKey(d) <= toKey; d = new Date(d.getTime() + DAY_MS)) keys.push(dayKey(d));
  return keys;
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string; currency?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations('analytics');
  const tm = await getTranslations('months');
  const tCat = await getTranslations('defaultCategories');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  await processRecurring(user.id);

  // Davr: oxirgi N oy (joriy oy bilan). Taqqoslash — oldingi teng davrning "shu nuqtasi"gacha,
  // aks holda tugamagan joriy oy to'liq o'tgan oy bilan solishtirilib, xarajat doim "kamaygan" ko'rinadi
  const period = parsePeriod(sp.period);
  const now = new Date();
  const todayKey = dayKey(now);
  const [cy, cm] = todayKey.split('-').map(Number);
  const from = monthStart(cy, cm - period + 1);
  const to = monthStart(cy, cm + 1);
  const prevFrom = monthStart(cy, cm - 2 * period + 1);
  const prevTo = new Date(prevFrom.getTime() + (now.getTime() - from.getTime()));
  const fromKey = dayKey(from);

  const usedCurrencies = await prisma.transaction.groupBy({
    by: ['currency'],
    where: { userId: user.id, type: { in: ['INCOME', 'EXPENSE'] } },
  });
  const currencies = usedCurrencies.map(r => r.currency).sort((a, b) => (CURRENCY_RANK[a] ?? 9) - (CURRENCY_RANK[b] ?? 9));
  const currency = sp.currency && currencies.includes(sp.currency) ? sp.currency : currencies[0] ?? 'UZS';

  const [txs, categoryRank, wallets, topExpenses] = await Promise.all([
    // Kirim/chiqim (o'tkazma va qarzlar oylik statistikadagidek kirmaydi), tanlangan valyutada
    prisma.transaction.findMany({
      where: { userId: user.id, currency, type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: prevFrom, lt: to } },
      select: { type: true, amount: true, category: true, date: true },
    }),
    // Kategoriya rangi butun davrdagi o'rni bo'yicha — filtr o'zgarsa ham rang o'sha kategoriyada qoladi
    prisma.transaction.groupBy({
      by: ['category'],
      where: { userId: user.id, currency, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
    prisma.wallet.findMany({ where: { userId: user.id, currency }, select: { id: true, balance: true, createdAt: true } }),
    prisma.transaction.findMany({
      where: { userId: user.id, currency, type: 'EXPENSE', date: { gte: from, lt: to } },
      orderBy: { amount: 'desc' },
      take: 5,
      select: { id: true, amount: true, category: true, description: true, date: true, wallet: { select: { name: true } } },
    }),
  ]);

  const current = txs.filter(tx => tx.date >= from);
  const previous = txs.filter(tx => tx.date < prevTo);
  const sum = (rows: typeof txs, type: 'INCOME' | 'EXPENSE') =>
    rows.filter(r => r.type === type).reduce((s, r) => s + Number(r.amount), 0);
  const fmt = (n: number) => formatMoney(n, currency, locale);
  const catLabel = (key: string) => (key ? categoryName(key, tCat) : t('uncategorized'));
  const catHref = (key: string, type: 'INCOME' | 'EXPENSE') =>
    transactionsHref(locale, { type, category: key || UNCATEGORIZED, from: fromKey, to: todayKey });

  // ── Raqamli kartalar ────────────────────────────────────────────────
  const income = sum(current, 'INCOME');
  const expense = sum(current, 'EXPENSE');
  const net = income - expense;
  const rate = income > 0 ? (net / income) * 100 : null;
  const prevIncome = sum(previous, 'INCOME');
  const prevExpense = sum(previous, 'EXPENSE');
  const prevNet = prevIncome - prevExpense;
  const prevRate = prevIncome > 0 ? (prevNet / prevIncome) * 100 : null;
  const hasPrev = previous.length > 0;

  const dirOf = (d: number): 'up' | 'down' | 'flat' => (Math.abs(d) < 0.05 ? 'flat' : d > 0 ? 'up' : 'down');
  // O'zgarish: rang = yo'nalish × "o'sish yaxshimi" (xarajatda o'sish yomon). Belgi + matn bilan — rang yolg'iz emas
  const pctDelta = (cur: number, prev: number, upIsGood: boolean): Delta => {
    if (!hasPrev || prev <= 0) return null;
    const d = ((cur - prev) / prev) * 100;
    const dir = dirOf(d);
    return { text: `${Math.abs(Math.round(d))}%`, dir, good: dir === 'flat' ? null : (dir === 'up') === upIsGood };
  };
  const tiles: { label: string; value: string; delta: Delta }[] = [
    { label: t('income'), value: fmt(income), delta: pctDelta(income, prevIncome, true) },
    { label: t('expense'), value: fmt(expense), delta: pctDelta(expense, prevExpense, false) },
    {
      label: t('net'),
      value: formatMoneySigned(net, currency, locale),
      delta: hasPrev ? { text: fmt(Math.abs(net - prevNet)), dir: dirOf(net - prevNet), good: dirOf(net - prevNet) === 'flat' ? null : net > prevNet } : null,
    },
    {
      label: t('savingsRate'),
      value: rate == null ? '—' : `${Math.round(rate)}%`,
      delta: rate != null && prevRate != null
        ? { text: t('pp', { value: Math.abs(Math.round(rate - prevRate)) }), dir: dirOf(rate - prevRate), good: dirOf(rate - prevRate) === 'flat' ? null : rate > prevRate }
        : null,
    },
  ];

  // ── Oylar (grafik + jadval) ─────────────────────────────────────────
  // Brauzerda o'zbekcha oy nomlari yo'q — yorliqlar serverda tarjimadan
  const spansYears = Number(fromKey.slice(0, 4)) !== cy;
  const monthRanges = Array.from({ length: period }, (_, i) => {
    const start = monthStart(cy, cm - period + 1 + i);
    const end = monthStart(cy, cm - period + 2 + i);
    const [y, m] = dayKey(start).split('-').map(Number);
    const name = tm(`m${m}`);
    return {
      start, end, y, m,
      label: `${name.slice(0, 3)}${spansYears && (i === 0 || m === 1) ? ` ${String(y).slice(2)}` : ''}`,
      full: `${name} ${y}`,
    };
  });
  const months: MonthPoint[] = monthRanges.map((r) => {
    const rows = current.filter(x => x.date >= r.start && x.date < r.end);
    const inc = sum(rows, 'INCOME');
    const exp = sum(rows, 'EXPENSE');
    return { key: `${r.y}-${r.m}`, label: r.label, full: r.full, income: inc, expense: exp, net: inc - exp };
  });

  // O'rtacha "oyiga" — faqat kirim/chiqim bo'lgan oylar bo'yicha (kuzatuv boshlanmagan bo'sh oylar o'rtachani tushirmasin)
  const activeMonths = Math.max(months.filter(m => m.income > 0 || m.expense > 0).length, 1);

  // ── Xarajatlar tarkibi (doira ≤6 bo'lak + ro'yxat) ───────────────────
  const slotOf = new Map(
    categoryRank
      .map(r => ({ key: r.category ?? '', total: Number(r._sum.amount ?? 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, CATEGORY_SLOTS)
      .map((r, i) => [r.key, i + 1] as const),
  );
  const colorOf = (key: string) => (slotOf.has(key) ? `var(--viz-cat-${slotOf.get(key)})` : 'var(--viz-other)');
  const expenseByCategory = new Map<string, number>();
  const incomeByCategory = new Map<string, number>();
  for (const r of current) {
    const map = r.type === 'EXPENSE' ? expenseByCategory : incomeByCategory;
    map.set(r.category ?? '', (map.get(r.category ?? '') ?? 0) + Number(r.amount));
  }
  const slotted = Array.from(expenseByCategory).filter(([key]) => slotOf.has(key)).sort((a, b) => b[1] - a[1]);
  const rest = Array.from(expenseByCategory).filter(([key]) => !slotOf.has(key)).sort((a, b) => b[1] - a[1]);
  const restTotal = rest.reduce((s, [, v]) => s + v, 0);
  const segments: DonutSegment[] = [
    ...slotted.map(([key, amount]) => ({
      key: key || '__none__', label: catLabel(key), amount, pct: expense > 0 ? (amount / expense) * 100 : 0,
      color: colorOf(key), href: catHref(key, 'EXPENSE'),
    })),
    ...(restTotal > 0
      ? [{ key: '__rest__', label: t('other'), amount: restTotal, pct: expense > 0 ? (restTotal / expense) * 100 : 0, color: 'var(--viz-other)', href: null }]
      : []),
  ];

  // ── Kategoriyalar dinamikasi (kichik grafiklar, har biri o'z rangida) ─
  const categoryTrends = slotted.map(([key, total]) => ({
    key,
    label: catLabel(key),
    total,
    color: colorOf(key),
    href: catHref(key, 'EXPENSE'),
    data: monthRanges.map<BarPoint>((r) => ({
      key: `${r.y}-${r.m}`,
      label: r.label,
      full: r.full,
      value: current
        .filter(x => x.type === 'EXPENSE' && (x.category ?? '') === key && x.date >= r.start && x.date < r.end)
        .reduce((s, x) => s + Number(x.amount), 0),
    })),
  }));

  // ── Hafta kunlari: har bir kunga o'rtacha (shu kun davrda necha marta bo'lgani bo'yicha) ─
  const periodDays = dayKeys(fromKey, todayKey);
  const weekdayOf = (key: string) => (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = dushanba
  const weekdayCount = Array(7).fill(0) as number[];
  for (const key of periodDays) weekdayCount[weekdayOf(key)] += 1;
  const weekdaySum = Array(7).fill(0) as number[];
  for (const r of current.filter(x => x.type === 'EXPENSE')) weekdaySum[weekdayOf(dayKey(r.date))] += Number(r.amount);
  const weekdays: BarPoint[] = weekdaySum.map((total, i) => ({
    key: String(i),
    label: t(`weekdays.d${i}`),
    full: t(`weekdaysFull.d${i}`),
    value: weekdayCount[i] > 0 ? total / weekdayCount[i] : 0,
  }));
  const dailyAverage = periodDays.length > 0 ? expense / periodDays.length : 0;

  // ── Balans dinamikasi: kun oxiridagi jami (shu valyutadagi hamyonlar) ─
  // Hozirgi balansdan keyingi yozuvlar ta'sirini qaytarib hisoblanadi; hamyon o'sha paytda mavjud bo'lsa qo'shiladi
  // (yaratilgan yoki o'sha paytgacha yozuvi bor — bosh sahifadagi qoida)
  const ids = wallets.map(w => w.id);
  const [laterTxs, firstFrom, firstTo] = ids.length === 0 ? [[], [], []] : await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: dayEnd(fromKey) }, OR: [{ walletId: { in: ids } }, { toWalletId: { in: ids } }] },
      orderBy: { date: 'desc' },
      select: { type: true, walletId: true, toWalletId: true, amount: true, toAmount: true, date: true },
    }),
    prisma.transaction.groupBy({ by: ['walletId'], where: { userId: user.id, walletId: { in: ids } }, _min: { date: true } }),
    prisma.transaction.groupBy({ by: ['toWalletId'], where: { userId: user.id, toWalletId: { in: ids } }, _min: { date: true } }),
  ]);
  const firstSeen = new Map<string, number>();
  for (const w of wallets) firstSeen.set(w.id, w.createdAt.getTime());
  for (const r of firstFrom) if (r._min.date) firstSeen.set(r.walletId, Math.min(firstSeen.get(r.walletId)!, r._min.date.getTime()));
  for (const r of firstTo) if (r.toWalletId && r._min.date) firstSeen.set(r.toWalletId, Math.min(firstSeen.get(r.toWalletId)!, r._min.date.getTime()));
  const running = new Map(wallets.map(w => [w.id, Number(w.balance)]));
  const balanceDesc: BalancePoint[] = [];
  let li = 0;
  for (const key of [...periodDays].reverse()) {
    const end = dayEnd(key);
    for (; li < laterTxs.length && laterTxs[li].date >= end; li++) {
      for (const e of balanceEffects(laterTxs[li])) {
        if (running.has(e.walletId)) running.set(e.walletId, running.get(e.walletId)! - e.delta);
      }
    }
    const value = wallets.filter(w => firstSeen.get(w.id)! < end.getTime()).reduce((s, w) => s + running.get(w.id)!, 0);
    const [y, m, d] = key.split('-').map(Number);
    balanceDesc.push({ key, full: `${d} ${tm(`m${m}`)} ${y}`, value });
  }
  const balanceSeries = balanceDesc.reverse();
  const balanceTicks = period === 1
    ? periodDays.filter(k => ['01', '08', '15', '22', '29'].includes(k.slice(8)))
    : periodDays.filter(k => k.endsWith('-01'));
  const balanceTickLabels = Object.fromEntries(balanceTicks.map((k) => {
    const [y, m, d] = k.split('-').map(Number);
    const short = tm(`m${m}`).slice(0, 3);
    return [k, period === 1 ? `${d} ${short}` : `${short}${spansYears && (m === 1 || k === balanceTicks[0]) ? ` ${String(y).slice(2)}` : ''}`];
  }));
  const balanceChange = balanceSeries.length > 1 ? balanceSeries.at(-1)!.value - balanceSeries[0].value : 0;

  // ── Daromad manbalari ───────────────────────────────────────────────
  const incomeRows = Array.from(incomeByCategory).sort((a, b) => b[1] - a[1]);
  const maxIncome = Math.max(...incomeRows.map(([, v]) => v), 1);

  const periodLabel = `${formatDay(from, locale)} — ${formatDay(now, locale)}`;

  return (
    <div className="space-y-4">
      <StickyHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <Suspense>
            <AnalyticsFilters period={period} currency={currency} currencies={currencies} />
          </Suspense>
        </div>
        <p className="text-xs text-muted-foreground">{periodLabel}</p>
      </StickyHeader>

      {current.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      ) : (
        <>
          {/* Raqamli kartalar: bitta son uchun grafik emas — qiymat va o'tgan davrga nisbatan o'zgarish */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((tile) => (
              <Card key={tile.label}>
                <CardContent className="space-y-1 pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">{tile.label}</p>
                  <p className="text-xl font-semibold sm:text-2xl">{tile.value}</p>
                  {tile.delta ? (
                    <p className={`flex items-center gap-1 text-xs ${
                      tile.delta.good == null ? 'text-muted-foreground' : tile.delta.good ? 'text-green-700 dark:text-green-500' : 'text-red-600'
                    }`}>
                      {tile.delta.dir === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" />
                        : tile.delta.dir === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" />
                        : <Minus className="h-3.5 w-3.5" />}
                      <span>{tile.delta.text}</span>
                      <span className="text-muted-foreground">{t('vsPrevious')}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('noComparison')}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Daromad va xarajat oylar bo'yicha */}
          {period > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('trendTitle')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('trendSubtitle')}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <IncomeExpenseChart
                  data={months}
                  currency={currency}
                  locale={locale}
                  labels={{ income: t('income'), expense: t('expense'), net: t('net'), chartLabel: t('trendTitle') }}
                />
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">{t('tableView')}</summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs tabular-nums">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="py-1.5 pr-3 text-left font-medium">{t('month')}</th>
                          <th className="py-1.5 pr-3 text-right font-medium">{t('income')}</th>
                          <th className="py-1.5 pr-3 text-right font-medium">{t('expense')}</th>
                          <th className="py-1.5 text-right font-medium">{t('net')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {months.map((m) => (
                          <tr key={m.key} className="border-b last:border-0">
                            <td className="py-1.5 pr-3">{m.full}</td>
                            <td className="py-1.5 pr-3 text-right">{fmt(m.income)}</td>
                            <td className="py-1.5 pr-3 text-right">{fmt(m.expense)}</td>
                            <td className="py-1.5 text-right">{formatMoneySigned(m.net, currency, locale)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Xarajatlar tarkibi: doira — ulush bir qarashda; ro'yxat — aniq qiymatlar va havolalar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('categoryTitle')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('categorySubtitle')}</p>
              </CardHeader>
              <CardContent>
                {segments.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t('noExpenses')}</p>
                ) : (
                  <CategoryBreakdown
                    segments={segments}
                    restItems={rest.map(([key, amount]) => ({ key: key || '__none__', label: catLabel(key), amount, href: catHref(key, 'EXPENSE') }))}
                    total={expense}
                    totalLabel={t('totalLabel')}
                    currency={currency}
                    locale={locale}
                  />
                )}
              </CardContent>
            </Card>

            {/* Balans dinamikasi */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-base">
                  {t('balanceTitle')}
                  {balanceSeries.length > 1 && (
                    <span className={`text-sm font-semibold ${balanceChange >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-600'}`}>
                      {balanceChange >= 0 ? '+' : '-'}{fmt(Math.abs(balanceChange))}
                    </span>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t('balanceSubtitle', { currency })}</p>
              </CardHeader>
              <CardContent>
                {wallets.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t('noWallets', { currency })}</p>
                ) : (
                  <BalanceChart
                    data={balanceSeries}
                    ticks={balanceTicks}
                    tickLabels={balanceTickLabels}
                    currency={currency}
                    locale={locale}
                    label={t('balanceTitle')}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Kategoriyalar dinamikasi — ixcham jadval: har kategoriya bitta qatorda, oylar bo'yicha mini-ustunlar
              (sparkline, umumiy shkala bilan — kategoriyalar bir-biri bilan solishtiriladi), oyiga o'rtacha va jami */}
          {period > 1 && categoryTrends.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('categoryTrendTitle')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('categoryTrendSubtitle')}</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 border-b px-4 pb-1.5 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                  <span>{t('category')}</span>
                  <span className="hidden sm:block">{months[0]?.label} — {months.at(-1)?.label}</span>
                  <span className="text-right">{t('perMonthAvg')}</span>
                  <span className="text-right">{t('periodTotal')}</span>
                </div>
                {categoryTrends.map((c) => {
                  const peak = Math.max(...categoryTrends.flatMap(x => x.data.map(d => d.value)), 1);
                  return (
                    <Link
                      key={c.key || '__none__'}
                      href={c.href}
                      className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 border-b px-4 py-2 last:border-0 hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: c.color }} />
                        <span className="truncate group-hover:underline">{c.label}</span>
                      </span>
                      <span className="hidden h-6 items-end gap-0.5 sm:flex" aria-hidden>
                        {c.data.map((d) => (
                          <span
                            key={d.key}
                            title={`${d.full}: ${fmt(d.value)}`}
                            className="w-2 rounded-t-[2px]"
                            style={{
                              height: d.value > 0 ? `${Math.max((d.value / peak) * 100, 8)}%` : '2px',
                              backgroundColor: d.value > 0 ? c.color : 'var(--viz-grid)',
                            }}
                          />
                        ))}
                      </span>
                      <span className="text-right text-xs tabular-nums text-muted-foreground">{fmt(c.total / activeMonths)}</span>
                      <span className="text-right text-sm font-medium tabular-nums">{fmt(c.total)}</span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Hafta kunlari bo'yicha o'rtacha xarajat */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('weekdayTitle')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('weekdaySubtitle', { amount: fmt(dailyAverage) })}</p>
              </CardHeader>
              <CardContent>
                <SimpleBarChart data={weekdays} color="var(--viz-series-2)" currency={currency} locale={locale} label={t('weekdayTitle')} />
              </CardContent>
            </Card>

            {/* Daromad manbalari */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('incomeSourcesTitle')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('incomeSourcesSubtitle', { total: fmt(income) })}</p>
              </CardHeader>
              <CardContent>
                {incomeRows.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t('noIncome')}</p>
                ) : (
                  <div className="space-y-1">
                    {incomeRows.map(([key, amount]) => (
                      <Link key={key || '__none__'} href={catHref(key, 'INCOME')} className="group -mx-2 block space-y-1 rounded-md px-2 py-1.5 hover:bg-muted/60">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate group-hover:underline">{catLabel(key)}</span>
                          <span className="shrink-0 tabular-nums">
                            {fmt(amount)} <span className="text-xs text-muted-foreground">{income > 0 ? Math.round((amount / income) * 100) : 0}%</span>
                          </span>
                        </div>
                        <div className="h-2">
                          <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max((amount / maxIncome) * 100, 1)}%`, backgroundColor: 'var(--viz-series-1)' }} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Eng katta xarajatlar */}
          {topExpenses.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('topExpensesTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {topExpenses.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{catLabel(tx.category ?? '')}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDay(tx.date, locale)} · {tx.wallet.name}{tx.description && ` · ${tx.description}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{fmt(Number(tx.amount))}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
