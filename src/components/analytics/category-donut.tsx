'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, type PieSectorShapeProps } from 'recharts';
import { formatCompact, formatMoney } from '@/lib/intl';

// href null — "Boshqa" (ichidagi kategoriyalar restItems'da)
export type DonutSegment = { key: string; label: string; amount: number; pct: number; color: string; href: string | null };
export type RestItem = { key: string; label: string; amount: number; href: string };

const GROW = 8; // tanlangan bo'lak qancha tashqariga chiqadi (px)

// Xarajatlar ulushi: doira (≤6 bo'lak, 2px fon oralig'i) + qiymatli ro'yxat. Ikkalasi bog'langan:
// sichqoncha olib borilgan / bosilgan bo'lak kattalashadi, ro'yxatdagi qatori ajraladi, markazda uning nomi va summasi.
// Tooltip yo'q — markazdagi matn bilan ustma-ust tushmasin
export function CategoryBreakdown({
  segments, restItems, total, totalLabel, currency, locale,
}: {
  segments: DonutSegment[]; restItems: RestItem[]; total: number; totalLabel: string; currency: string; locale: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = hovered ?? pinned;
  const current = active != null ? segments[active] : null;
  const fmt = (n: number) => formatMoney(n, currency, locale);

  const shape = (props: PieSectorShapeProps) => (
    <Sector
      cx={props.cx}
      cy={props.cy}
      innerRadius={props.innerRadius}
      outerRadius={props.index === active ? props.outerRadius + GROW : props.outerRadius}
      startAngle={props.startAngle}
      endAngle={props.endAngle}
      fill={props.fill}
      stroke="hsl(var(--card))"
      strokeWidth={2}
      style={{ cursor: 'pointer', outline: 'none' }}
    />
  );

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
      {/* Fokus ramkasi o'chirilgan: klaviatura bilan ro'yxatdagi havolalar orqali ishlanadi */}
      <div className="relative mx-auto h-56 w-56 [&_*:focus]:outline-none" role="img" aria-label={totalLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer={false}>
            <Pie
              data={segments}
              dataKey="amount"
              nameKey="label"
              innerRadius="58%"
              outerRadius="88%"
              startAngle={90}
              endAngle={-270}
              rootTabIndex={-1}
              isAnimationActive={false}
              shape={shape}
              onMouseEnter={(_, index) => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onClick={(_, index) => setPinned(p => (p === index ? null : index))}
            >
              {segments.map((s) => <Cell key={s.key} fill={s.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
          {current ? (
            <>
              <span className="line-clamp-2 text-xs leading-tight text-muted-foreground">{current.label}</span>
              <span className="text-lg font-semibold">{formatCompact(current.amount, locale)}</span>
              <span className="text-xs text-muted-foreground">{currency} · {Math.round(current.pct)}%</span>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">{totalLabel}</span>
              <span className="text-lg font-semibold">{formatCompact(total, locale)}</span>
              <span className="text-xs text-muted-foreground">{currency}</span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-0.5">
        {segments.map((s, i) => {
          const isActive = i === active;
          const row = (
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
              <span className={`min-w-0 flex-1 truncate ${isActive ? 'font-medium' : ''} group-hover:underline`}>{s.label}</span>
              <span className="shrink-0 tabular-nums">{fmt(s.amount)}</span>
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{Math.round(s.pct)}%</span>
            </div>
          );
          const hover = { onMouseEnter: () => setHovered(i), onMouseLeave: () => setHovered(null) };
          const cls = `group block rounded-md px-2 py-1.5 ${isActive ? 'bg-muted' : 'hover:bg-muted/60'}`;
          if (!s.href) {
            return (
              <details key={s.key} className={cls} {...hover}>
                <summary className="cursor-pointer list-none">{row}</summary>
                <div className="mt-1 space-y-0.5 border-l pl-3">
                  {restItems.map((r) => (
                    <Link key={r.key} href={r.href} className="flex justify-between gap-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline">
                      <span className="truncate">{r.label}</span>
                      <span className="shrink-0 tabular-nums">{fmt(r.amount)}</span>
                    </Link>
                  ))}
                </div>
              </details>
            );
          }
          return <Link key={s.key} href={s.href} className={cls} {...hover}>{row}</Link>;
        })}
      </div>
    </div>
  );
}
