import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DebtDialog } from '@/components/debts/debt-dialog';
import { EditCounterpartyDialog, MergeCounterpartyDialog } from '@/components/counterparties/counterparty-actions';
import { deleteCounterparty } from '@/lib/actions/counterparty';
import { normalizeName } from '@/lib/counterparty';
import { DebtPaymentDialog } from '@/components/debts/debt-payment-dialog';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { deleteDebt, deleteDebtPayment } from '@/lib/actions/debt';
import { debtProgress, initialTxType, repayTxType } from '@/lib/debt';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, CreditCard } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { formatMoney } from '@/lib/intl';
import { formatDay } from '@/lib/days';
import { StickyHeader } from '@/components/sticky-header';
import { CreditUsage } from '@/components/wallets/credit-usage';
import { TransactionDialog } from '@/components/transactions/transaction-dialog';
import { creditInfo, walletOption } from '@/lib/credit';


function sumByCurrency(items: { currency: string; value: number }[]) {
  const map = new Map<string, number>();
  for (const { currency, value } of items) map.set(currency, (map.get(currency) ?? 0) + value);
  return Array.from(map).filter(([, v]) => v > 0);
}

export default async function DebtsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  const showClosed = status === 'closed';
  const showStats = status === 'stats';
  const showPeople = status === 'people';
  const t = await getTranslations('debts');
  const formatAmount = (n: number, currency: string) => formatMoney(n, currency, locale);
  const formatDate = (date: Date) => formatDay(date, locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const [debtRows, wallets, categories, counterparties] = await Promise.all([
    prisma.debt.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      include: {
        transactions: {
          orderBy: { date: 'asc' },
          include: { wallet: { select: { name: true } } },
        },
      },
    }),
    prisma.wallet.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.category.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
    prisma.counterparty.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } }),
  ]);
  const counterpartyOptions = counterparties.map(c => ({ id: c.id, name: c.name, phone: c.phone }));

  const walletList = wallets.map(w => ({ id: w.id, name: w.name, currency: w.currency }));
  const debts = debtRows.map(d => ({ ...d, progress: debtProgress(d) }));
  const open = debts.filter(d => !d.progress.closed);
  const visible = showClosed ? debts.filter(d => d.progress.closed) : open;

  const owedToMe = sumByCurrency(
    open.filter(d => d.type === 'LENT').map(d => ({ currency: d.currency, value: d.progress.remaining })),
  );
  const iOwe = sumByCurrency(
    open.filter(d => d.type === 'BORROWED').map(d => ({ currency: d.currency, value: d.progress.remaining })),
  );

  // Kredit kartalar: qarz = manfiy qoldiq (alohida yozuv emas — xarid va to'lovlardan o'zi hisoblanadi).
  // Shaxsiy qarzlar bilan aralashtirilmaydi: "Mening qarzlarim" ostida alohida qator, pastda alohida blok
  const creditCards = wallets
    .filter(w => w.kind === 'CREDIT')
    .map(w => ({ ...w, debt: Math.max(-Number(w.balance), 0), info: creditInfo(w) }))
    .sort((a, b) => b.debt - a.debt);
  const cardDebt = sumByCurrency(creditCards.map(c => ({ currency: c.currency, value: c.debt })));
  const txWallets = wallets.map(walletOption);
  const categoryList = categories.map(c => ({ id: c.id, name: c.name, icon: c.icon }));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Hisobot: yo'nalish (berilgan/olingan) va valyuta bo'yicha butun davr jami
  const directionStats = (type: 'LENT' | 'BORROWED') => {
    const map = new Map<string, { total: number; repaid: number; remaining: number; count: number; closed: number }>();
    for (const d of debts.filter(x => x.type === type)) {
      const s = map.get(d.currency) ?? { total: 0, repaid: 0, remaining: 0, count: 0, closed: 0 };
      s.total += d.progress.amount;
      s.repaid += d.progress.paid;
      s.remaining += d.progress.remaining;
      s.count += 1;
      if (d.progress.closed) s.closed += 1;
      map.set(d.currency, s);
    }
    return Array.from(map);
  };

  // Hisobot: odam (ism katta-kichik harfsiz) va valyuta bo'yicha; saldo > 0 — menga qarzdor
  const people = new Map<string, {
    person: string; currency: string; lent: number; gotBack: number; borrowed: number; paidBack: number; last: Date;
  }>();
  for (const d of debts) {
    const key = `${d.counterpartyId ?? normalizeName(d.person)}::${d.currency}`;
    const p = people.get(key) ?? { person: d.person.trim(), currency: d.currency, lent: 0, gotBack: 0, borrowed: 0, paidBack: 0, last: d.date };
    if (d.type === 'LENT') { p.lent += d.progress.amount; p.gotBack += d.progress.paid; }
    else { p.borrowed += d.progress.amount; p.paidBack += d.progress.paid; }
    const lastTx = d.transactions.at(-1)?.date ?? d.date;
    if (lastTx > p.last) p.last = lastTx;
    people.set(key, p);
  }
  const personRows = Array.from(people.values())
    .map(p => ({ ...p, net: (p.lent - p.gotBack) - (p.borrowed - p.paidBack) }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || b.last.getTime() - a.last.getTime());

  // "Odamlar" tabi: har bir odam bo'yicha qarzlar soni va valyuta bo'yicha saldo (> 0 — menga qarzdor)
  const peopleStats = new Map<string, { count: number; open: number; net: Map<string, number> }>();
  for (const d of debts) {
    if (!d.counterpartyId) continue;
    const st = peopleStats.get(d.counterpartyId) ?? { count: 0, open: 0, net: new Map<string, number>() };
    st.count += 1;
    if (!d.progress.closed) st.open += 1;
    const sign = d.type === 'LENT' ? 1 : -1;
    st.net.set(d.currency, (st.net.get(d.currency) ?? 0) + sign * d.progress.remaining);
    peopleStats.set(d.counterpartyId, st);
  }

  // "Ochiq" tabi: ochiq qarzlar kontragent bo'yicha guruhlanadi (muddati o'tgani bor guruhlar birinchi, keyin nomi bo'yicha)
  const cpName = new Map(counterparties.map(c => [c.id, c.name]));
  const groupMap = new Map<string, { key: string; name: string; debts: typeof open; nets: Map<string, number>; overdue: number }>();
  for (const d of open) {
    const key = d.counterpartyId ?? `name:${normalizeName(d.person)}`;
    const g = groupMap.get(key) ?? { key, name: (d.counterpartyId && cpName.get(d.counterpartyId)) || d.person, debts: [] as typeof open, nets: new Map<string, number>(), overdue: 0 };
    g.debts.push(d);
    g.nets.set(d.currency, (g.nets.get(d.currency) ?? 0) + (d.type === 'LENT' ? 1 : -1) * d.progress.remaining);
    if (d.dueDate != null && d.dueDate < startOfToday) g.overdue += 1;
    groupMap.set(key, g);
  }
  const openGroups = Array.from(groupMap.values())
    .map(g => ({ ...g, nets: Array.from(g.nets) }))
    .sort((a, b) => (b.overdue > 0 ? 1 : 0) - (a.overdue > 0 ? 1 : 0) || a.name.localeCompare(b.name));

  // Arxivda: qarz yopilgan sana — oxirgi qaytarish yozuvi
  const closedOn = (d: (typeof debts)[number]) =>
    d.transactions.filter(tx => tx.type === repayTxType(d.type)).at(-1)?.date ?? null;

  // Qarz kartasi (ochiq guruh ichida va arxivda). showPerson=false — guruh sarlavhasida ism bor, takrorlanmaydi
  const debtCard = (d: (typeof debts)[number], showPerson = true) => {
    const { amount, paid, remaining, closed } = d.progress;
    const isLent = d.type === 'LENT';
    const overdue = !closed && d.dueDate != null && d.dueDate < startOfToday;
    const pct = amount > 0 ? Math.min((paid / amount) * 100, 100) : 0;
    const payments = d.transactions.filter(t => t.type === repayTxType(d.type));

    return (
      <Card key={d.id} className={overdue ? 'border-red-300' : undefined}>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {showPerson && <p className="font-semibold">{d.person}</p>}
                <Badge variant="secondary" className={isLent ? 'text-green-700' : 'text-red-700'}>
                  {isLent ? t('owedToMe') : t('iOwe')}
                </Badge>
                {overdue && <Badge variant="destructive">{t('overdue')}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(d.date)}
                {' • '}{d.transactions.find(t => t.type === initialTxType(d.type))?.wallet.name ?? t('noWallet')}
                {d.dueDate && !closed && <> • {t('due')}: <span className={overdue ? 'text-red-600 font-medium' : ''}>{formatDate(d.dueDate)}</span></>}
                {closed && closedOn(d) && <> • {t('closedOn', { date: formatDate(closedOn(d)!) })}</>}
                {d.phone && <> • {d.phone}</>}
              </p>
              {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!closed && (
                <DebtPaymentDialog
                  debt={{ id: d.id, type: d.type, person: d.person, currency: d.currency, remaining }}
                  wallets={walletList}
                />
              )}
              <DebtDialog
                wallets={walletList}
                counterparties={counterpartyOptions}
                debt={{
                  id: d.id,
                  type: d.type,
                  person: d.person,
                  counterpartyId: d.counterpartyId,
                  currency: d.currency,
                  walletId: d.transactions.find(t => t.type === initialTxType(d.type))?.walletId ?? null,
                  dueDate: d.dueDate?.toISOString() ?? null,
                  description: d.description,
                  amount,
                  paid,
                }}
              />
              <ConfirmDeleteButton
                id={d.id}
                action={deleteDebt}
                title={t('deleteTitle')}
                description={t('deleteDescription')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {isLent ? t('repaid') : t('paid')}: {formatAmount(paid, d.currency)} / {formatAmount(amount, d.currency)}
              </span>
              <span className={`font-semibold ${closed ? 'text-green-600' : ''}`}>
                {closed ? t('closed') : t('left', { amount: formatAmount(remaining, d.currency) })}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${closed ? 'bg-green-500' : isLent ? 'bg-emerald-400' : 'bg-amber-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {payments.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                {isLent ? t('repayments', { count: payments.length }) : t('payments', { count: payments.length })}
              </summary>
              <div className="mt-2 divide-y rounded-lg border">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <p className="text-sm">{formatAmount(Number(p.amount), p.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.date)} • {p.wallet.name}{p.description && ` • ${p.description}`}
                      </p>
                    </div>
                    <ConfirmDeleteButton
                      id={p.id}
                      action={deleteDebtPayment}
                      title={t('deletePaymentTitle')}
                      description={t('deletePaymentDescription')}
                    />
                  </div>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Sarlavha va tablar (Ochiq / Arxiv / Hisobot) qotib turadi */}
      <StickyHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <DebtDialog wallets={walletList} counterparties={counterpartyOptions} />
        </div>

        <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
          {[
            { href: `/${locale}/debts`, label: t('tabOpen', { count: open.length }), active: !showClosed && !showStats && !showPeople },
            { href: `/${locale}/debts?status=closed`, label: t('tabClosed', { count: debts.length - open.length }), active: showClosed },
            { href: `/${locale}/debts?status=people`, label: t('tabPeople', { count: counterparties.length }), active: showPeople },
            { href: `/${locale}/debts?status=stats`, label: t('tabStats'), active: showStats },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab.active ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </StickyHeader>

      {/* Yig'indilar */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('owedToMeTotal')}</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {owedToMe.length === 0 ? (
              <div className="text-2xl font-bold text-muted-foreground">0</div>
            ) : (
              owedToMe.map(([cur, v]) => (
                <div key={cur} className="text-2xl font-bold text-green-600">{formatAmount(v, cur)}</div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('iOweTotal')}</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {iOwe.length === 0 ? (
              <div className="text-2xl font-bold text-muted-foreground">0</div>
            ) : (
              iOwe.map(([cur, v]) => (
                <div key={cur} className="text-2xl font-bold text-red-600">{formatAmount(v, cur)}</div>
              ))
            )}
            {cardDebt.map(([cur, v]) => (
              <p key={cur} className="mt-1 text-xs text-muted-foreground">{t('plusCards', { amount: formatAmount(v, cur) })}</p>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Kredit kartalar — ochiq qarzlar tabida; to'lov = kartaga o'tkazma (oldindan to'ldirilgan oyna) */}
      {!showClosed && !showStats && !showPeople && creditCards.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              {t('creditCardsTitle')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t('creditCardsHint')}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {creditCards.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className={`text-sm font-semibold tabular-nums ${c.debt > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {c.debt > 0 ? t('cardDebt', { amount: formatAmount(c.debt, c.currency) }) : t('noCardDebt')}
                    </p>
                  </div>
                  {c.info && <CreditUsage info={c.info} currency={c.currency} />}
                </div>
                {c.debt > 0 && (
                  <TransactionDialog
                    wallets={txWallets}
                    savedCategories={categoryList}
                    preset={{ type: 'TRANSFER', toWalletId: c.id }}
                    triggerLabel={t('payCard')}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}


      {showPeople ? (
        counterparties.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">{t('noPeople')}</CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('peopleTitle')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('peopleHint')}</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {counterparties.map((c) => {
                  const st = peopleStats.get(c.id);
                  const nets = st ? Array.from(st.net).filter(([, v]) => Math.abs(v) >= 0.005) : [];
                  return (
                    <div key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('peopleDebts', { count: st?.count ?? 0, open: st?.open ?? 0 })}
                          {c.phone && <> · {c.phone}</>}
                          {c.note && <> · {c.note}</>}
                        </p>
                        <div className="flex flex-wrap gap-x-3 text-sm font-semibold tabular-nums">
                          {nets.length === 0 ? (
                            <span className="font-normal text-muted-foreground">{t('netSettled')}</span>
                          ) : nets.map(([cur, v]) => (
                            <span key={cur} className={v > 0 ? 'text-green-600' : 'text-red-600'}>
                              {v > 0 ? t('netOwesMe', { amount: formatAmount(v, cur) }) : t('netIOwe', { amount: formatAmount(-v, cur) })}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <EditCounterpartyDialog counterparty={{ id: c.id, name: c.name, phone: c.phone, note: c.note }} />
                        <MergeCounterpartyDialog
                          counterparty={{ id: c.id, name: c.name, phone: c.phone }}
                          others={counterpartyOptions.filter(o => o.id !== c.id)}
                        />
                        {!st && (
                          <ConfirmDeleteButton
                            id={c.id}
                            action={deleteCounterparty}
                            title={t('deletePersonTitle')}
                            description={t('deletePersonDescription', { name: c.name })}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )
      ) : showStats ? (
        debts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">{t('noDebtsYet')}</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Butun davr: berilgan va olingan qarzlar */}
            <div className="grid gap-4 sm:grid-cols-2">
              {(['LENT', 'BORROWED'] as const).map((type) => {
                const rows = directionStats(type);
                const isLent = type === 'LENT';
                return (
                  <Card key={type}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-sm font-medium">
                        {isLent ? t('lentSection') : t('borrowedSection')}
                        {isLent
                          ? <ArrowUpRight className="h-4 w-4 text-green-600" />
                          : <ArrowDownLeft className="h-4 w-4 text-red-600" />}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {rows.length === 0 ? (
                        <p className="text-muted-foreground">—</p>
                      ) : rows.map(([cur, s]) => (
                        <div key={cur} className="space-y-1">
                          <div className="flex justify-between font-semibold">
                            <span>{t('statTotal')}</span>
                            <span className="tabular-nums">{formatAmount(s.total, cur)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>{isLent ? t('statRepaid') : t('statPaid')}</span>
                            <span className="tabular-nums">{formatAmount(s.repaid, cur)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('statRemaining')}</span>
                            <span className={`tabular-nums font-medium ${s.remaining > 0 ? (isLent ? 'text-green-600' : 'text-red-600') : ''}`}>
                              {formatAmount(s.remaining, cur)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{t('statCount', { closed: s.closed, total: s.count })}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Odamlar bo'yicha: kim bilan qancha oldi-berdi va hozirgi saldo */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('byPerson')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {personRows.map((p) => (
                    <div key={`${p.person}::${p.currency}`} className="space-y-1 px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold">{p.person}</span>
                        <span className={`font-semibold tabular-nums ${p.net > 0 ? 'text-green-600' : p.net < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {p.net > 0
                            ? t('netOwesMe', { amount: formatAmount(p.net, p.currency) })
                            : p.net < 0
                              ? t('netIOwe', { amount: formatAmount(-p.net, p.currency) })
                              : t('netSettled')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                        {p.lent > 0 && <span>{t('personLent')}: {formatAmount(p.lent, p.currency)} · {t('personGotBack')}: {formatAmount(p.gotBack, p.currency)}</span>}
                        {p.borrowed > 0 && <span>{t('personBorrowed')}: {formatAmount(p.borrowed, p.currency)} · {t('personPaidBack')}: {formatAmount(p.paidBack, p.currency)}</span>}
                        <span>{formatDate(p.last)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {showClosed ? t('noClosed') : t('noOpen')}
          </CardContent>
        </Card>
      ) : (
        showClosed ? (
          <div className="space-y-3">{visible.map(d => debtCard(d))}</div>
        ) : (
          // Ochiq qarzlar kontragentlar bo'yicha: qator bosilsa — uning ochiq qarzlari ochiladi
          <div className="space-y-3">
            {openGroups.map((g) => (
              <details key={g.key} className="group rounded-xl border bg-card" open={openGroups.length === 1}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{g.name}</p>
                      {g.overdue > 0 && <Badge variant="destructive">{t('overdue')}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('openDebtsCount', { count: g.debts.length })}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right text-sm font-semibold tabular-nums">
                      {g.nets.map(([cur, v]) => (
                        <p key={cur} className={v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                          {v > 0
                            ? t('netOwesMe', { amount: formatAmount(v, cur) })
                            : v < 0 ? t('netIOwe', { amount: formatAmount(-v, cur) }) : t('netSettled')}
                        </p>
                      ))}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </div>
                </summary>
                <div className="space-y-3 border-t p-3">{g.debts.map(d => debtCard(d, false))}</div>
              </details>
            ))}
          </div>
        )
      )}
    </div>
  );
}
