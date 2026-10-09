'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompact, formatMoney } from '@/lib/intl';

export type BarPoint = { key: string; label: string; full: string; value: number };

type TooltipProps = { active?: boolean; payload?: { payload: BarPoint }[]; currency: string; locale: string; color: string };

function BarTooltip({ active, payload, currency, locale, color }: TooltipProps) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 text-muted-foreground">{p.full}</p>
      <div className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: color }} />
        <span className="font-semibold tabular-nums">{formatMoney(p.value, currency, locale)}</span>
      </div>
    </div>
  );
}

// Bitta seriyali ustunlar (legenda shart emas — sarlavha nima ekanini aytadi).
// compact — kichik grafiklar uchun (o'qlar va to'r chiziqlarsiz, faqat ustun va tooltip)
export function SimpleBarChart({
  data, color, currency, locale, height = 200, compact = false, label,
}: {
  data: BarPoint[]; color: string; currency: string; locale: string; height?: number; compact?: boolean; label: string;
}) {
  return (
    <div className="w-full" style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={compact ? { top: 4, right: 0, bottom: 0, left: 0 } : { top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
          {!compact && <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />}
          <XAxis
            dataKey="label"
            hide={compact}
            tickLine={false}
            axisLine={{ stroke: 'var(--viz-axis)' }}
            tick={{ fill: 'var(--viz-muted)', fontSize: 12 }}
          />
          <YAxis
            hide={compact}
            width={64}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--viz-muted)', fontSize: 12 }}
            tickFormatter={(v: number) => formatCompact(v, locale)}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
            content={<BarTooltip currency={currency} locale={locale} color={color} />}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
