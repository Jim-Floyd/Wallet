'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Barcha matnlar serverda formatlanadi (brauzerda o'zbekcha oy nomlari yo'q)
export type FlowCategory = { label: string; amount: string; pct: number };
export type FlowItem = { id: string; date: string; title: string; subtitle: string; amount: string };

// Bosh sahifadagi "Oylik daromad/xarajat" kartasi: bosilganda oy ro'yxati — kategoriyalar jami va har bir yozuv
export function MonthlyFlowCard({
  kind,
  title,
  monthLabel,
  totals,
  categories,
  items,
  href,
  children,
}: {
  kind: 'income' | 'expense';
  title: string;
  monthLabel: string;
  totals: string[];
  categories: FlowCategory[];
  items: FlowItem[];
  href: string;
  children: ReactNode;
}) {
  const t = useTranslations('dashboard');
  const [open, setOpen] = useState(false);
  const color = kind === 'income' ? 'text-green-600' : 'text-red-600';
  const bar = kind === 'income' ? 'bg-green-500' : 'bg-red-400';

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {children}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Sarlavha, jami va kategoriyalar qotib turadi — faqat yozuvlar ro'yxati aylanadi */}
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {monthLabel} · {t('flowCount', { count: items.length })}
            </DialogDescription>
          </DialogHeader>

          <div className={`flex shrink-0 flex-wrap gap-x-4 text-xl font-bold tabular-nums ${color}`}>
            {totals.map((total) => <span key={total}>{total}</span>)}
          </div>

          {items.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">{t('flowEmpty')}</p>
          ) : (
            <>
              {/* Kategoriyalar bo'yicha (juda ko'p bo'lsa, o'zi alohida aylanadi) */}
              <section className="-mx-4 max-h-[30vh] shrink-0 space-y-1.5 overflow-y-auto px-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('byCategory')}</p>
                {categories.map((c) => (
                  <div key={c.label} className="space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <span className="truncate">{c.label}</span>
                      <span className="shrink-0 tabular-nums">
                        {c.amount} <span className="text-xs text-muted-foreground">({Math.round(c.pct)}%)</span>
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-muted">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </section>

              {/* Har bir yozuv — aylanadigan qism */}
              <section className="flex min-h-0 flex-1 flex-col gap-1">
                <p className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('records')}</p>
                <div className="min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.date} · {item.subtitle}</p>
                      </div>
                      <span className={`shrink-0 font-semibold tabular-nums ${color}`}>{item.amount}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <Link
            href={href}
            className="flex shrink-0 items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {t('openInTransactions')}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </DialogContent>
      </Dialog>
    </>
  );
}
