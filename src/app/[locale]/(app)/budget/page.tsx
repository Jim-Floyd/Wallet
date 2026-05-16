import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BudgetMonthNav } from '@/components/budget/budget-month-nav';
import { BudgetDialog } from '@/components/budget/budget-dialog';
import { deleteBudgetAction } from '@/lib/actions/budget';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

function formatAmount(n: number, currency: string) {
  return `${new Intl.NumberFormat('uz-UZ').format(n)} ${currency}`;
}

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

  const now = new Date();
  const month = parseInt(sp.month ?? String(now.getMonth() + 1));
  const year = parseInt(sp.year ?? String(now.getFullYear()));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const [budgets, txs, categories] = await Promise.all([
    prisma.budget.findMany({
      where: { userId: user.id, month, year },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: 'EXPENSE',
        date: { gte: start, lte: end },
        category: { not: null },
      },
      select: { category: true, amount: true, currency: true },
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    }),
  ]);

  // category::currency → spent amount
  const spentMap = new Map<string, number>();
  for (const tx of txs) {
    if (!tx.category) continue;
    const key = `${tx.category}::${tx.currency}`;
    spentMap.set(key, (spentMap.get(key) ?? 0) + Number(tx.amount));
  }

  const categoryNames = categories.map((c) => c.name);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Byudjet</h1>
        <BudgetDialog month={month} year={year} categories={categoryNames} />
      </div>

      <Suspense>
        <BudgetMonthNav month={month} year={year} />
      </Suspense>

      {budgets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Bu oy uchun byudjet belgilanmagan
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const spent = spentMap.get(`${b.category}::${b.currency}`) ?? 0;
            const limit = Number(b.amount);
            const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
            const over = spent > limit;

            const barColor = over
              ? 'bg-red-500'
              : pct >= 75
              ? 'bg-amber-400'
              : 'bg-green-500';

            return (
              <Card key={b.id}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{b.category}</p>
                      <p className={`text-sm ${over ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {formatAmount(spent, b.currency)}
                        {' / '}
                        {formatAmount(limit, b.currency)}
                        {over && ' — limit oshib ketdi!'}
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

                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
