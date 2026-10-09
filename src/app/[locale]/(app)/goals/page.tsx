import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { processRecurring } from '@/lib/recurring-server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StickyHeader } from '@/components/sticky-header';
import { GoalDialog } from '@/components/goals/goal-dialog';
import { GoalContributeDialog } from '@/components/goals/goal-contribute-dialog';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { deleteGoal } from '@/lib/actions/goal';
import { CURRENCY_RANK } from '@/lib/currency';
import { dayKey, formatDay, monthStart } from '@/lib/days';
import { formatMoney, formatMoneySigned } from '@/lib/intl';

const MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;
const HISTORY_MONTHS = 3;

type Status = 'onTrack' | 'atRisk' | 'overdue' | 'open';

export default async function GoalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('goals');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  await processRecurring(user.id);

  const fmt = (n: number, cur: string) => formatMoney(n, cur, locale);
  const now = new Date();
  const [cy, cm] = dayKey(now).split('-').map(Number);
  const histFrom = monthStart(cy, cm - HISTORY_MONTHS);
  const thisMonth = monthStart(cy, cm);

  const [goals, history, currentMonthTxs, budgets] = await Promise.all([
    prisma.goal.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
    // Imkoniyat uchun: oxirgi to'liq oylardagi kirim/chiqim (o'tkazma va qarzlar kirmaydi)
    prisma.transaction.findMany({
      where: { userId: user.id, type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: histFrom, lt: thisMonth } },
      select: { type: true, amount: true, currency: true, category: true, date: true },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: thisMonth } },
      select: { type: true, amount: true, currency: true, category: true, date: true },
    }),
    prisma.budget.findMany({ where: { userId: user.id, month: cm, year: cy } }),
  ]);

  // Oylik jamg'arish imkoniyati (valyuta bo'yicha) = o'rtacha daromad − shu oy byudjet limitlari − byudjetga kirmagan o'rtacha xarajat.
  // To'liq oy tarixi bo'lmasa — joriy oy bo'yicha taxminiy
  const monthsWithData = new Set(history.map(tx => dayKey(tx.date).slice(0, 7))).size;
  const partial = monthsWithData === 0;
  const rows = partial ? currentMonthTxs : history;
  const n = Math.max(monthsWithData, 1);
  const budgetKeys = new Set(budgets.map(b => `${b.category}::${b.currency}`));

  const currencies = Array.from(new Set([...goals.map(g => g.currency), ...rows.filter(r => r.type === 'INCOME').map(r => r.currency)]))
    .sort((a, b) => (CURRENCY_RANK[a] ?? 9) - (CURRENCY_RANK[b] ?? 9));
  const capacity = new Map(currencies.map((cur) => {
    const sum = (pred: (r: (typeof rows)[number]) => boolean) =>
      rows.filter(r => r.currency === cur && pred(r)).reduce((s, r) => s + Number(r.amount), 0);
    const income = sum(r => r.type === 'INCOME') / n;
    const budgeted = budgets.filter(b => b.currency === cur).reduce((s, b) => s + Number(b.amount), 0);
    const unbudgeted = sum(r => r.type === 'EXPENSE' && !budgetKeys.has(`${r.category}::${cur}`)) / n;
    return [cur, { income, budgeted, unbudgeted, free: income - budgeted - unbudgeted }];
  }));

  // Maqsadlar: muddatlilar muddat bo'yicha navbat bilan bo'sh mablag'dan "oladi"; yetmasa — xavf ostida.
  // Muddatsizlar uchun — qolgan bo'sh mablag' bilan taxminiy necha oyda
  const active = goals.filter(g => Number(g.currentAmount) < Number(g.targetAmount));
  const done = goals.filter(g => Number(g.currentAmount) >= Number(g.targetAmount));
  const plan = new Map<string, { status: Status; required: number | null; shortfall: number; monthsLeft: number | null; eta: number | null }>();
  const needByCurrency = new Map<string, number>();

  for (const cur of currencies) {
    let avail = Math.max(capacity.get(cur)?.free ?? 0, 0);
    const mine = active.filter(g => g.currency === cur);
    const withDeadline = mine.filter(g => g.deadline).sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime());
    let need = 0;
    for (const g of withDeadline) {
      const remaining = Number(g.targetAmount) - Number(g.currentAmount);
      const left = (g.deadline!.getTime() - now.getTime()) / MONTH_MS;
      if (left <= 0) {
        plan.set(g.id, { status: 'overdue', required: null, shortfall: 0, monthsLeft: null, eta: null });
        continue;
      }
      const required = remaining / Math.max(left, 1);
      need += required;
      if (avail >= required) {
        avail -= required;
        plan.set(g.id, { status: 'onTrack', required, shortfall: 0, monthsLeft: Math.ceil(left), eta: null });
      } else {
        plan.set(g.id, { status: 'atRisk', required, shortfall: required - avail, monthsLeft: Math.ceil(left), eta: null });
        avail = 0;
      }
    }
    for (const g of mine.filter(g => !g.deadline)) {
      const remaining = Number(g.targetAmount) - Number(g.currentAmount);
      plan.set(g.id, { status: 'open', required: null, shortfall: 0, monthsLeft: null, eta: avail > 0 ? Math.ceil(remaining / avail) : null });
    }
    needByCurrency.set(cur, need);
  }

  const statusBadge: Record<Status, { label: string; className: string } | null> = {
    onTrack: { label: t('onTrack'), className: 'text-green-700' },
    atRisk: { label: t('atRisk'), className: 'text-amber-700' },
    overdue: { label: t('overdue'), className: 'text-red-700' },
    open: null,
  };

  const goalCard = (g: (typeof goals)[number], isDone: boolean) => {
    const target = Number(g.targetAmount);
    const current = Number(g.currentAmount);
    const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    const p = plan.get(g.id);
    const badge = isDone ? { label: t('done'), className: 'text-green-700' } : p ? statusBadge[p.status] : null;
    return (
      <Card key={g.id}>
        <CardContent className="space-y-3 pt-4 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{g.name}</p>
                {badge && <Badge variant="secondary" className={badge.className}>{badge.label}</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {g.deadline ? t('due', { date: formatDay(g.deadline, locale) }) : t('noDeadline')}
                {p?.monthsLeft != null && <> · {t('monthsLeft', { count: p.monthsLeft })}</>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!isDone && (
                <GoalContributeDialog
                  goal={{
                    id: g.id,
                    name: g.name,
                    currency: g.currency,
                    remainingLabel: t('remaining', { amount: fmt(target - current, g.currency) }),
                    suggested: p?.required != null ? Math.ceil(Math.min(p.required, target - current)) : null,
                  }}
                />
              )}
              <GoalDialog
                goal={{
                  id: g.id, name: g.name, targetAmount: target, currentAmount: current, currency: g.currency,
                  deadline: g.deadline ? dayKey(g.deadline) : null,
                }}
              />
              <ConfirmDeleteButton id={g.id} action={deleteGoal} title={t('deleteTitle')} description={t('deleteDescription')} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground tabular-nums">{fmt(current, g.currency)} / {fmt(target, g.currency)}</span>
              <span className="font-semibold tabular-nums">{Math.round(pct)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${isDone ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>

          {!isDone && p && (
            <div className="space-y-0.5 text-xs">
              {p.required != null && <p className="font-medium">{t('perMonth', { amount: fmt(p.required, g.currency) })}</p>}
              {p.status === 'atRisk' && <p className="text-amber-600">{t('shortfall', { amount: fmt(p.shortfall, g.currency) })}</p>}
              {p.status === 'overdue' && <p className="text-red-600">{t('remaining', { amount: fmt(target - current, g.currency) })}</p>}
              {p.status === 'open' && (
                <p className="text-muted-foreground">{p.eta != null ? t('eta', { count: p.eta }) : t('noCapacity')}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Oylik bo'sh mablag' taqsimoti: har bir muddatli maqsadga oyiga kerakli ulush (qat'iy tartibdagi kategorik ranglar,
  // muddat bo'yicha), ortib qolgani — kulrang. Kerak > imkoniyat bo'lsa, shkala kerakli bo'yicha va imkoniyat
  // chegarasida vertikal belgi turadi. Segmentlar orasida 2px oraliq; har bir qiymat legendada yozilgan
  const allocationChart = (cur: string, free: number, need: number) => {
    const parts = active
      .filter(g => g.currency === cur && g.deadline && plan.get(g.id)?.required != null)
      .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())
      .map((g, i) => ({
        id: g.id,
        name: g.name,
        value: plan.get(g.id)!.required!,
        color: i < 5 ? `var(--viz-cat-${i + 1})` : 'var(--viz-other)',
      }));
    if (parts.length === 0) return null;
    const leftover = Math.max(free - need, 0);
    const scale = Math.max(free, need, 1);
    return (
      <div className="space-y-2 pt-2" role="img" aria-label={t('allocationTitle')}>
        <p className="text-xs font-medium text-muted-foreground">{t('allocationTitle')}</p>
        <div className="relative">
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-[4px] bg-muted">
            {parts.map((p) => (
              <div key={p.id} className="h-full shrink-0" style={{ width: `${(p.value / scale) * 100}%`, backgroundColor: p.color }} title={p.name} />
            ))}
            {leftover > 0 && <div className="h-full shrink-0" style={{ width: `${(leftover / scale) * 100}%`, backgroundColor: 'var(--viz-other)' }} />}
          </div>
          {need > free && (
            <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-foreground" style={{ left: `${(free / scale) * 100}%` }} title={t('capacityMarker')} />
          )}
        </div>
        <div className="space-y-0.5 text-xs">
          {parts.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: p.color }} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 tabular-nums">{fmt(p.value, cur)}</span>
            </div>
          ))}
          {leftover > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: 'var(--viz-other)' }} />
              <span className="min-w-0 flex-1 truncate">{t('leftover')}</span>
              <span className="shrink-0 tabular-nums">{fmt(leftover, cur)}</span>
            </div>
          )}
          {need > free && (
            <div className="flex items-center gap-2 text-amber-600">
              <span className="inline-block h-3 w-0.5 shrink-0 rounded bg-foreground" />
              <span className="min-w-0 flex-1 truncate">{t('capacityMarker')}</span>
              <span className="shrink-0 tabular-nums">{fmt(free, cur)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <StickyHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <GoalDialog />
        </div>
      </StickyHeader>

      {/* Oylik jamg'arish imkoniyati — byudjet limitlari hisobga olingan */}
      {currencies.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {currencies.map((cur) => {
            const c = capacity.get(cur)!;
            const need = needByCurrency.get(cur) ?? 0;
            const hasGoals = active.some(g => g.currency === cur && g.deadline);
            return (
              <Card key={cur}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('capacityTitle')}{currencies.length > 1 ? ` (${cur})` : ''}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {partial ? t('partialData') : t('capacityPeriod', { count: monthsWithData })}
                  </p>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  {c.income === 0 ? (
                    <p className="text-muted-foreground">{t('noIncome')}</p>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('avgIncome')}</span>
                        <span className="tabular-nums text-green-600">+{fmt(c.income, cur)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('budgetPlanned')}</span>
                        <span className="tabular-nums text-red-600">-{fmt(c.budgeted, cur)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('unbudgeted')}</span>
                        <span className="tabular-nums text-red-600">-{fmt(c.unbudgeted, cur)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1.5 font-semibold">
                        <span>{t('canSave')}</span>
                        <span className={`tabular-nums ${c.free >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatMoneySigned(c.free, cur, locale)}
                        </span>
                      </div>
                      {hasGoals && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('goalsNeed')}</span>
                            <span className="tabular-nums">{fmt(need, cur)}</span>
                          </div>
                          <p className={`pt-1 text-xs font-medium ${c.free >= need ? 'text-green-700 dark:text-green-400' : 'text-amber-600'}`}>
                            {c.free >= need
                              ? t('enough', { amount: fmt(c.free - need, cur) })
                              : t('notEnough', { amount: fmt(need - Math.max(c.free, 0), cur) })}
                          </p>
                          {allocationChart(cur, Math.max(c.free, 0), need)}
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {active.map(g => goalCard(g, false))}
          {done.length > 0 && (
            <details className="space-y-3">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                {t('doneSection', { count: done.length })}
              </summary>
              <div className="mt-3 space-y-3">{done.map(g => goalCard(g, true))}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
