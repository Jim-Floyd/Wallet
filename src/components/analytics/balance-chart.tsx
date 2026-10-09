'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompact, formatMoneySigned } from '@/lib/intl';

// key — "YYYY-MM-DD"; full — tooltip uchun tayyor sana matni (serverda, o'zbekcha oy nomlari bilan)
export type BalancePoint = { key: string; full: string; value: number };

type TooltipProps = { active?: boolean; payload?: { payload: BalancePoint }[]; currency: string; locale: string };

function BalanceTooltip({ active, payload, currency, locale }: TooltipProps) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 text-muted-foreground">{p.full}</p>
      <div className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: 'var(--viz-series-1)' }} />
        <span className="font-semibold tabular-nums">{formatMoneySigned(p.value, currency, locale)}</span>
      </div>
    </div>
  );
}

// Jami pul kunma-kun: bitta seriya — 2px chiziq + ~10% shaffof maydon, kursor sanani topadi.
// ticks — oy boshlari (yorliqlari tickLabels'da)
export function BalanceChart({
  data, ticks, tickLabels, currency, locale, label,
}: {
  data: BalancePoint[]; ticks: string[]; tickLabels: Record<string, string>; currency: string; locale: string; label: string;
}) {
  const hasNegative = data.some(d => d.value < 0);
  return (
    <div className="h-56 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
          <XAxis
            dataKey="key"
            ticks={ticks}
            tickFormatter={(k: string) => tickLabels[k] ?? ''}
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
            domain={['auto', 'auto']}
          />
          {hasNegative && <ReferenceLine y={0} stroke="var(--viz-axis)" />}
          <Tooltip
            cursor={{ stroke: 'var(--viz-axis)', strokeWidth: 1 }}
            content={<BalanceTooltip currency={currency} locale={locale} />}
          />
          <Area
            dataKey="value"
            type="linear"
            stroke="var(--viz-series-1)"
            strokeWidth={2}
            fill="var(--viz-series-1)"
            fillOpacity={0.1}
            activeDot={{ r: 4, fill: 'var(--viz-series-1)', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
