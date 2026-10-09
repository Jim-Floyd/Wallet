'use client';

import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatCompact, formatMoney, formatMoneySigned } from '@/lib/intl';

export type MonthPoint = { key: string; label: string; full: string; income: number; expense: number; net: number };

type Labels = { income: string; expense: string; net: string; chartLabel: string };

const SERIES = [
  { key: 'income', color: 'var(--viz-series-1)', shape: 'bar' },
  { key: 'expense', color: 'var(--viz-series-2)', shape: 'bar' },
  { key: 'net', color: 'var(--viz-ink-2)', shape: 'line' },
] as const;

// Legenda mark'ni takrorlaydi: ustun uchun to'rtburchak, chiziq uchun qisqa chiziq. Matn — matn rangida
function LegendKey({ shape, color }: { shape: 'bar' | 'line'; color: string }) {
  return shape === 'bar'
    ? <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
    : <span className="inline-block h-0.5 w-3.5 rounded" style={{ backgroundColor: color }} />;
}

type TooltipProps = {
  active?: boolean;
  payload?: { payload: MonthPoint }[];
  labels: Labels;
  currency: string;
  locale: string;
};

// Bitta tooltip — shu oydagi hamma seriya; qiymat oldinda (qalin), seriya nomi ikkinchi darajada
function ChartTooltip({ active, payload, labels, currency, locale }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 font-medium text-muted-foreground">{point.full}</p>
      <div className="space-y-1">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: s.color }} />
            <span className="font-semibold tabular-nums">
              {s.key === 'net' ? formatMoneySigned(point.net, currency, locale) : formatMoney(point[s.key], currency, locale)}
            </span>
            <span className="text-muted-foreground">{labels[s.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Daromad va xarajat oylar bo'yicha: ikki ustun + sof natija chizig'i, bitta so'm o'qi (ikkinchi o'q yo'q)
export function IncomeExpenseChart({
  data, currency, locale, labels,
}: { data: MonthPoint[]; currency: string; locale: string; labels: Labels }) {
  const hasNegative = data.some(d => d.net < 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <LegendKey shape={s.shape} color={s.color} />
            {labels[s.key]}
          </span>
        ))}
      </div>
      <div className="h-64 w-full" role="img" aria-label={labels.chartLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 12 }}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--viz-muted)', fontSize: 12 }}
              tickFormatter={(v: number) => formatCompact(v, locale)}
            />
            {hasNegative && <ReferenceLine y={0} stroke="var(--viz-axis)" />}
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
              content={<ChartTooltip labels={labels} currency={currency} locale={locale} />}
            />
            <Bar dataKey="income" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="expense" fill="var(--viz-series-2)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Line
              dataKey="net"
              type="linear"
              stroke="var(--viz-ink-2)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
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
