'use client';

import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompact, formatMoney } from '@/lib/intl';

// limit null — o'sha oyda byudjet yo'q
export type BudgetMonth = { key: string; label: string; full: string; spent: number; limit: number | null };

type Labels = { spent: string; limit: string; over: string; chartLabel: string };

const OVER = '#d03b3b'; // status: critical — faqat "limitdan oshgan" holati uchun, belgi va yozuv bilan birga

type TooltipProps = { active?: boolean; payload?: { payload: BudgetMonth }[]; labels: Labels; currency: string; locale: string };

function BudgetTooltip({ active, payload, labels, currency, locale }: TooltipProps) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const over = p.limit != null && p.spent > p.limit;
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 text-muted-foreground">{p.full}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: over ? OVER : 'var(--viz-series-2)' }} />
          <span className="font-semibold tabular-nums">{formatMoney(p.spent, currency, locale)}</span>
          <span className="text-muted-foreground">{labels.spent}</span>
        </div>
        {p.limit != null && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: 'var(--viz-ink-2)' }} />
            <span className="font-semibold tabular-nums">{formatMoney(p.limit, currency, locale)}</span>
            <span className="text-muted-foreground">{labels.limit}</span>
          </div>
        )}
        {over && <p className="font-medium text-red-600">⚠ {labels.over}</p>}
      </div>
    </div>
  );
}

// Byudjet tarixi: sarflangan (ustun) va limit (chiziq, nuqtalar bilan) — bitta so'm o'qi.
// Limitdan oshgan oy ustuni "critical" rangida; legenda va tooltip'da yozuv bilan
export function BudgetHistoryChart({
  data, labels, currency, locale,
}: { data: BudgetMonth[]; labels: Labels; currency: string; locale: string }) {
  const anyOver = data.some(d => d.limit != null && d.spent > d.limit);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: 'var(--viz-series-2)' }} />
          {labels.spent}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3.5 rounded" style={{ backgroundColor: 'var(--viz-ink-2)' }} />
          {labels.limit}
        </span>
        {anyOver && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: OVER }} />
            ⚠ {labels.over}
          </span>
        )}
      </div>
      <div className="h-52 w-full" role="img" aria-label={labels.chartLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--viz-axis)' }} tick={{ fill: 'var(--viz-muted)', fontSize: 12 }} />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--viz-muted)', fontSize: 12 }}
              tickFormatter={(v: number) => formatCompact(v, locale)}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
              content={<BudgetTooltip labels={labels} currency={currency} locale={locale} />}
            />
            <Bar dataKey="spent" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.limit != null && d.spent > d.limit ? OVER : 'var(--viz-series-2)'} />
              ))}
            </Bar>
            <Line
              dataKey="limit"
              type="linear"
              connectNulls={false}
              stroke="var(--viz-ink-2)"
              strokeWidth={2}
              dot={{ r: 4, fill: 'var(--viz-ink-2)', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: 'var(--viz-ink-2)', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
