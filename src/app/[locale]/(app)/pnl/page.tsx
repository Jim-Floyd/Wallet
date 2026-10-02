import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthNav } from '@/components/month-nav';
import { processRecurring } from '@/lib/recurring-server';
import { balanceEffects } from '@/lib/balance';
import { categoryName } from '@/lib/category-icons';
import { CURRENCY_RANK } from '@/lib/currency';
import { formatDay, monthStart, parseMonthParams } from '@/lib/days';
import { debtProgress } from '@/lib/debt';
import { formatMoneySigned } from '@/lib/intl';

const TREND_MONTHS = 6;

type SearchParams = { month?: string; year?: string };
type Flow = { income: number; expense: number; debt: number; transfer: number };

export default async function PnlPage({
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

  const t = await getTranslations('pnl');
  const tCat = await getTranslations('defaultCategories');
  const fmt = (n: number, currency: string) => formatMoneySigned(n, currency, locale);
  const signed = (n: number, currency: string) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${fmt(Math.abs(n), currency)}`;

  const start = monthStart(year, month);
  const end = monthStart(year, month + 1);

  const [wallets, txs, debts] = await Promise.all([
    prisma.wallet.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, currency: true, balance: true, kind: true, createdAt: true },
    }),
    // Barcha davr: oy oqimlari, oy boshi/oxiri qoldig'i, dinamika va balansdagi ustav kapitali/taqsimlanmagan foyda uchun
    prisma.transaction.findMany({
      where: { userId: user.id },
      select: { type: true, walletId: true, toWalletId: true, amount: true, toAmount: true, currency: true, category: true, date: true },
    }),
    prisma.debt.findMany({
      where: { userId: user.id },
      include: { transactions: { select: { type: true, amount: true, date: true } } },
    }),
  ]);

  const walletCurrency = new Map(wallets.map(w => [w.id, w.currency]));
  const currencies = Array.from(new Set([...wallets.map(w => w.currency), ...txs.map(tx => tx.currency)]))
    .sort((a, b) => (CURRENCY_RANK[a] ?? 9) - (CURRENCY_RANK[b] ?? 9));

  // Hamyon berilgan paytda bormidi: shu paytgacha ochilgan yoki shu paytgacha yozuvi bor
  // (hamyon keyinroq qo'shilib, eski sana bilan to'ldirilgan bo'lishi mumkin)
  const firstTx = new Map<string, number>();
  for (const tx of txs) {
    for (const id of [tx.walletId, tx.toWalletId]) {
      if (id) firstTx.set(id, Math.min(firstTx.get(id) ?? Infinity, tx.date.getTime()));
    }
  }
  const existedAt = (w: (typeof wallets)[number], moment: Date) =>
    w.createdAt < moment || (firstTx.get(w.id) ?? Infinity) < moment.getTime();

  // Valyuta bo'yicha jami qoldiq berilgan paytda: hozirgi balansdan shu paytdan keyingi ta'sirlar ayriladi
  const balanceAt = (moment: Date) => {
    const present = new Set(wallets.filter(w => existedAt(w, moment)).map(w => w.id));
    const totals = new Map<string, number>();
    for (const w of wallets) if (present.has(w.id)) totals.set(w.currency, (totals.get(w.currency) ?? 0) + Number(w.balance));
    for (const tx of txs) {
      if (tx.date < moment) continue;
      for (const e of balanceEffects(tx)) {
        const cur = walletCurrency.get(e.walletId);
        if (cur && present.has(e.walletId)) totals.set(cur, (totals.get(cur) ?? 0) - e.delta);
      }
    }
    return totals;
  };
  const openingBalance = balanceAt(start);
  const closingBalance = balanceAt(end);

  // Oy ichidagi oqimlar: PNL (kirim/chiqim kategoriya bo'yicha) va balans harakati (qarz, o'tkazma)
  const flows = new Map<string, Flow>(currencies.map(c => [c, { income: 0, expense: 0, debt: 0, transfer: 0 }]));
  const byCategory = new Map<string, { income: Map<string, number>; expense: Map<string, number> }>(
    currencies.map(c => [c, { income: new Map(), expense: new Map() }]),
  );
  for (const tx of txs) {
    if (tx.date < start || tx.date >= end) continue;
    const amount = Number(tx.amount);
    if (tx.type === 'INCOME' || tx.type === 'EXPENSE') {
      const kind = tx.type === 'INCOME' ? 'income' : 'expense';
      flows.get(tx.currency)![kind] += amount;
      const cats = byCategory.get(tx.currency)![kind];
      const key = tx.category ?? '';
      cats.set(key, (cats.get(key) ?? 0) + amount);
      continue;
    }
    for (const e of balanceEffects(tx)) {
      const cur = walletCurrency.get(e.walletId);
      if (cur) flows.get(cur)![tx.type === 'TRANSFER' ? 'transfer' : 'debt'] += e.delta;
    }
  }

  // Dinamika: oxirgi TREND_MONTHS oy, valyuta bo'yicha kirim/chiqim
  const trendMonths = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const from = monthStart(year, month - TREND_MONTHS + 1 + i);
    return { from, to: monthStart(year, month - TREND_MONTHS + 2 + i), totals: new Map<string, { income: number; expense: number }>() };
  });
  for (const tx of txs) {
    if (tx.type !== 'INCOME' && tx.type !== 'EXPENSE') continue;
    const m = trendMonths.find(m => tx.date >= m.from && tx.date < m.to);
    if (!m) continue;
    const row = m.totals.get(tx.currency) ?? { income: 0, expense: 0 };
    row[tx.type === 'INCOME' ? 'income' : 'expense'] += Number(tx.amount);
    m.totals.set(tx.currency, row);
  }

  // Balans varag'i tanlangan oy oxiridagi holatga (end), valyuta bo'yicha.
  // Aktiv: musbat qoldiqli hamyonlar + sizga qarzdorlar (LENT qoldig'i).
  // Passiv: sizning qarzlaringiz (BORROWED qoldig'i) + manfiy qoldiqli hamyonlar. Sof kapital = aktiv − passiv
  // Hamyon ko'rsatiladi: oy oxirigacha ochilgan yoki oy oxirigacha yozuvi bor (keyinroq qo'shilib, eski sana bilan to'ldirilgan)
  const laterEffect = new Map<string, number>();
  for (const tx of txs) {
    if (tx.date < end) continue;
    for (const e of balanceEffects(tx)) laterEffect.set(e.walletId, (laterEffect.get(e.walletId) ?? 0) + e.delta);
  }
  const sheetWallets = wallets
    .filter(w => existedAt(w, end))
    .map(w => ({ ...w, balanceAtEnd: Number(w.balance) - (laterEffect.get(w.id) ?? 0) }));
  const sheetWalletIds = new Set(sheetWallets.map(w => w.id));

  type Line = { label: string; amount: number; credit?: boolean };
  type Sheet = { cash: Line[]; receivables: Line[]; payables: Line[]; overdrawn: Line[] };
  const sheets = new Map<string, Sheet>();
  const sheet = (cur: string) => {
    if (!sheets.has(cur)) sheets.set(cur, { cash: [], receivables: [], payables: [], overdrawn: [] });
    return sheets.get(cur)!;
  };
  for (const w of sheetWallets) {
    const balance = w.balanceAtEnd;
    if (balance < 0) sheet(w.currency).overdrawn.push({ label: w.name, amount: -balance, credit: w.kind === 'CREDIT' });
    else sheet(w.currency).cash.push({ label: w.name, amount: balance });
  }
  // Qarz oy oxirigacha ochilgan bo'lsa; qoldig'i — oy oxirigacha qaytarilganlar ayirilgan holda
  for (const d of debts) {
    if (d.date >= end) continue;
    const { remaining } = debtProgress({ ...d, transactions: d.transactions.filter(tx => tx.date < end) });
    if (remaining > 0) sheet(d.currency)[d.type === 'LENT' ? 'receivables' : 'payables'].push({ label: d.person, amount: remaining });
  }
  for (const s of Array.from(sheets.values())) {
    s.receivables.sort((a, b) => b.amount - a.amount);
    s.payables.sort((a, b) => b.amount - a.amount);
  }
  const sum = (lines: Line[]) => lines.reduce((acc, l) => acc + l.amount, 0);

  // O'z kapitali tarkibi (passivda). Oy oxirigacha bo'lgan yozuvlar bo'yicha, valyuta bo'yicha:
  //   ustav kapitali     = oy oxiridagi hamyonlar − o'shagacha tranzaksiyalar ta'siri (hamyon ochilgandagi boshlang'ich qoldiqlar)
  //   taqsimlanmagan foyda = oy oxirigacha jami daromad − jami xarajat
  //   valyuta farqi      = o'tkazmalarning shu valyutadagi sof ta'siri (bir valyuta ichidagisi 0 ga teng)
  //   boshqa tuzatish    = qolgan farq (hamyonsiz qarz yozuvlari, ortiqcha qaytarilgan qarz) — balans doim teng bo'lishi uchun
  const capital = new Map<string, { effects: number; retained: number; fx: number }>();
  const cap = (cur: string) => {
    if (!capital.has(cur)) capital.set(cur, { effects: 0, retained: 0, fx: 0 });
    return capital.get(cur)!;
  };
  for (const tx of txs) {
    if (tx.date >= end) continue;
    if (tx.type === 'INCOME') cap(tx.currency).retained += Number(tx.amount);
    if (tx.type === 'EXPENSE') cap(tx.currency).retained -= Number(tx.amount);
    for (const e of balanceEffects(tx)) {
      const cur = walletCurrency.get(e.walletId);
      if (!cur || !sheetWalletIds.has(e.walletId)) continue;
      cap(cur).effects += e.delta;
      if (tx.type === 'TRANSFER') cap(cur).fx += e.delta;
    }
  }

  const activeCurrencies = currencies.filter(c => {
    const f = flows.get(c)!;
    return f.income || f.expense || f.debt || f.transfer || openingBalance.get(c) || closingBalance.get(c);
  });
  const catLabel = (key: string) => (key ? categoryName(key, tCat) : t('uncategorized'));
  const monthLabel = (d: Date) => formatDay(d, locale, { month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Suspense>
          <MonthNav month={month} year={year} />
        </Suspense>
      </div>

      {activeCurrencies.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      )}

      {activeCurrencies.map((cur) => {
        const f = flows.get(cur)!;
        const net = f.income - f.expense;
        const savingsRate = f.income > 0 ? Math.round((net / f.income) * 100) : null;
        const cats = byCategory.get(cur)!;
        const sorted = (m: Map<string, number>) => Array.from(m).sort((a, b) => b[1] - a[1]);
        const opening = openingBalance.get(cur) ?? 0;
        const closing = closingBalance.get(cur) ?? 0;
        // Oy davomida ochilgan hamyonlarning boshlang'ich qoldig'i — tranzaksiya emas, shuning uchun alohida qator
        const newWallets = closing - opening - (f.income - f.expense + f.debt + f.transfer);

        return (
          <Card key={cur}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
                <span>{t('pnlFor', { currency: cur })}</span>
                <span className={`text-2xl tabular-nums ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {signed(net, cur)}
                </span>
              </CardTitle>
              <p className="text-right text-xs text-muted-foreground">
                {net >= 0 ? t('profit') : t('loss')}
                {savingsRate != null && ` · ${t('savingsRate', { pct: savingsRate })}`}
              </p>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              {/* PNL: daromad va xarajat kategoriyalar bo'yicha */}
              <div className="space-y-4 text-sm">
                <section className="space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span>{t('income')}</span>
                    <span className="tabular-nums text-green-600">+{fmt(f.income, cur)}</span>
                  </div>
                  {sorted(cats.income).map(([key, v]) => (
                    <div key={key} className="flex justify-between text-muted-foreground">
                      <span className="truncate">{catLabel(key)}</span>
                      <span className="tabular-nums">{fmt(v, cur)}</span>
                    </div>
                  ))}
                </section>
                <section className="space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span>{t('expense')}</span>
                    <span className="tabular-nums text-red-600">-{fmt(f.expense, cur)}</span>
                  </div>
                  {sorted(cats.expense).map(([key, v]) => {
                    const pct = f.expense > 0 ? (v / f.expense) * 100 : 0;
                    return (
                      <div key={key} className="space-y-0.5">
                        <div className="flex justify-between text-muted-foreground">
                          <span className="truncate">{catLabel(key)}</span>
                          <span className="tabular-nums">{fmt(v, cur)} <span className="text-xs">({Math.round(pct)}%)</span></span>
                        </div>
                        <div className="h-1 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </section>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>{t('net')}</span>
                  <span className={`tabular-nums ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{signed(net, cur)}</span>
                </div>
              </div>

              {/* Balans harakati: oy boshi → oy oxiri */}
              <div className="space-y-1.5 text-sm">
                <p className="font-semibold">{t('balanceMovement')}</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('opening', { date: formatDay(start, locale) })}</span>
                  <span className="tabular-nums">{fmt(opening, cur)}</span>
                </div>
                {([
                  ['income', f.income],
                  ['expense', -f.expense],
                  ['debts', f.debt],
                  ['transfers', f.transfer],
                  ...(Math.abs(newWallets) >= 0.005 ? [['newWallets', newWallets] as const] : []),
                ] as const).map(([key, v]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{t(`movement.${key}`)}</span>
                    <span className={`tabular-nums ${v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {signed(v, cur)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>{t('closing', { date: formatDay(new Date(end.getTime() - 1), locale) })}</span>
                  <span className="tabular-nums">{fmt(closing, cur)}</span>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">{t('movementHint')}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Balans varag'i — hozirgi holat: aktivlar | passivlar, pastda sof kapital */}
      {sheets.size > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{t('balanceSheet')}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {end.getTime() > Date.now()
                ? t('balanceSheetToday')
                : t('balanceSheetAsOf', { date: formatDay(new Date(end.getTime() - 1), locale) })}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {Array.from(sheets)
              .sort((a, b) => (CURRENCY_RANK[a[0]] ?? 9) - (CURRENCY_RANK[b[0]] ?? 9))
              .map(([cur, s]) => {
                const assets = sum(s.cash) + sum(s.receivables);
                const obligationLines = [
                  ...s.payables,
                  ...s.overdrawn.map(l => ({ ...l, label: `${l.label} (${t(l.credit ? 'creditWallet' : 'overdrawnWallet')})` })),
                ];
                const obligations = sum(obligationLines);
                const equity = assets - obligations;
                const c = capital.get(cur) ?? { effects: 0, retained: 0, fx: 0 };
                const shareCapital = sum(s.cash) - sum(s.overdrawn) - c.effects;
                const other = equity - shareCapital - c.retained - c.fx;
                const equityLines: Line[] = [
                  { label: t('shareCapital'), amount: shareCapital },
                  { label: t('retainedEarnings'), amount: c.retained },
                  ...(Math.abs(c.fx) >= 0.005 ? [{ label: t('fxDifference'), amount: c.fx }] : []),
                  ...(Math.abs(other) >= 0.005 ? [{ label: t('otherAdjustments'), amount: other }] : []),
                ];
                const group = (title: string, lines: Line[], subtotal: number) => lines.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span>{title}</span>
                      <span className="tabular-nums">{fmt(subtotal, cur)}</span>
                    </div>
                    {lines.map((l, i) => (
                      <div key={`${l.label}-${i}`} className="flex justify-between gap-2">
                        <span className="truncate">{l.label}</span>
                        <span className={`shrink-0 tabular-nums ${l.amount < 0 ? 'text-red-600' : ''}`}>{fmt(l.amount, cur)}</span>
                      </div>
                    ))}
                  </div>
                );
                return (
                  <section key={cur} className="space-y-3 text-sm">
                    {sheets.size > 1 && <p className="font-semibold">{cur}</p>}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3 rounded-lg border p-3">
                        <div className="flex justify-between font-semibold">
                          <span>{t('assets')}</span>
                          <span className="tabular-nums">{fmt(assets, cur)}</span>
                        </div>
                        {group(t('assetWallets'), s.cash, sum(s.cash))}
                        {group(t('receivables'), s.receivables, sum(s.receivables))}
                        {s.cash.length + s.receivables.length === 0 && <p className="text-muted-foreground">{t('none')}</p>}
                      </div>
                      <div className="space-y-3 rounded-lg border p-3">
                        <div className="flex justify-between font-semibold">
                          <span>{t('liabilities')}</span>
                          <span className="tabular-nums">{fmt(equity + obligations, cur)}</span>
                        </div>
                        {group(t('equity'), equityLines, equity)}
                        {group(t('obligations'), obligationLines, obligations)}
                      </div>
                    </div>
                    <p className="text-center text-xs text-muted-foreground">{t('balanceCheck')}</p>
                  </section>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* Dinamika — oxirgi oylar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t('trend', { count: TREND_MONTHS })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currencies
            .filter(cur => trendMonths.some(m => m.totals.has(cur)))
            .map((cur) => (
              <table key={cur} className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="py-1 text-left font-medium">{cur}</th>
                    <th className="py-1 text-right font-medium">{t('income')}</th>
                    <th className="py-1 text-right font-medium">{t('expense')}</th>
                    <th className="py-1 text-right font-medium">{t('net')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {trendMonths.map((m) => {
                    const row = m.totals.get(cur) ?? { income: 0, expense: 0 };
                    const n = row.income - row.expense;
                    return (
                      <tr key={m.from.toISOString()} className={m.from.getTime() === start.getTime() ? 'font-semibold' : ''}>
                        <td className="py-1 text-left">{monthLabel(m.from)}</td>
                        <td className="py-1 text-right text-green-600">{fmt(row.income, cur)}</td>
                        <td className="py-1 text-right text-red-600">{fmt(row.expense, cur)}</td>
                        <td className={`py-1 text-right ${n >= 0 ? 'text-green-700' : 'text-red-700'}`}>{signed(n, cur)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
