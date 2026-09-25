import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DebtDialog } from '@/components/debts/debt-dialog';
import { DebtPaymentDialog } from '@/components/debts/debt-payment-dialog';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { deleteDebt, deleteDebtPayment } from '@/lib/actions/debt';
import { debtProgress, initialTxType, repayTxType } from '@/lib/debt';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

function formatAmount(n: number, currency: string) {
  return `${new Intl.NumberFormat('uz-UZ').format(n)} ${currency}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const [debtRows, wallets] = await Promise.all([
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
  ]);

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

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Qarzlar</h1>
        <DebtDialog wallets={walletList} />
      </div>

      {/* Yig'indilar */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Menga qarzdorlar</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Mening qarzlarim</CardTitle>
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
          </CardContent>
        </Card>
      </div>

      {/* Ochiq / Yopilgan */}
      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {[
          { href: `/${locale}/debts`, label: `Ochiq (${open.length})`, active: !showClosed },
          { href: `/${locale}/debts?status=closed`, label: `Yopilgan (${debts.length - open.length})`, active: showClosed },
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

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {showClosed ? "Yopilgan qarzlar yo'q" : "Ochiq qarzlar yo'q"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((d) => {
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
                        <p className="font-semibold">{d.person}</p>
                        <Badge variant="secondary" className={isLent ? 'text-green-700' : 'text-red-700'}>
                          {isLent ? 'Menga qarzdor' : 'Mening qarzim'}
                        </Badge>
                        {overdue && <Badge variant="destructive">Muddati o&apos;tgan</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(d.date)}
                        {' • '}{d.transactions.find(t => t.type === initialTxType(d.type))?.wallet.name ?? 'Hamyonsiz'}
                        {d.dueDate && <> • Muddat: <span className={overdue ? 'text-red-600 font-medium' : ''}>{formatDate(d.dueDate)}</span></>}
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
                        debt={{
                          id: d.id,
                          type: d.type,
                          person: d.person,
                          phone: d.phone,
                          currency: d.currency,
                          walletId: d.transactions.find(t => t.type === initialTxType(d.type))?.walletId ?? null,
                          dueDate: d.dueDate?.toISOString() ?? null,
                          description: d.description,
                        }}
                      />
                      <ConfirmDeleteButton
                        id={d.id}
                        action={deleteDebt}
                        title="Qarzni o'chirish"
                        description="Qarz va unga bog'liq barcha yozuvlar o'chiriladi, hamyon balanslari avvalgi holatiga qaytariladi."
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {isLent ? 'Qaytarildi' : "To'landi"}: {formatAmount(paid, d.currency)} / {formatAmount(amount, d.currency)}
                      </span>
                      <span className={`font-semibold ${closed ? 'text-green-600' : ''}`}>
                        {closed ? 'Yopildi' : `Qoldi: ${formatAmount(remaining, d.currency)}`}
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
                        {isLent ? 'Qaytarishlar' : "To'lovlar"} ({payments.length})
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
                              title="Yozuvni o'chirish"
                              description="Bu qaytarish yozuvi o'chiriladi va hamyon balansi avvalgi holatiga qaytariladi."
                            />
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
