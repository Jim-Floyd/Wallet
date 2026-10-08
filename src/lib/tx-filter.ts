import { dayEnd, dayStart } from '@/lib/days';
import { txTypeWhere } from '@/lib/debt';

// Tranzaksiyalar sahifasi va eksportning URL filtrlari
export type TxFilters = { type?: string | null; walletId?: string | null; category?: string | null; from?: string | null; to?: string | null };

// ?category= qiymati: kategoriyasiz yozuvlar uchun
export const UNCATEGORIZED = '__none__';

// URL filtrlari → Prisma sharti (sahifa va eksportda bir xil)
export function transactionWhere(userId: string, f: TxFilters) {
  return {
    userId,
    ...txTypeWhere(f.type),
    // Hamyon filtri: shu hamyondan chiqqan va shu hamyonga o'tkazma bo'lib kelgan yozuvlar
    ...(f.walletId && { OR: [{ walletId: f.walletId }, { toWalletId: f.walletId }] }),
    ...(f.category && { category: f.category === UNCATEGORIZED ? null : f.category }),
    // Kunlar Toshkent vaqti bo'yicha: from kun boshidan, to kun oxirigacha
    ...((f.from || f.to) && {
      date: {
        ...(f.from && { gte: dayStart(f.from) }),
        ...(f.to && { lt: dayEnd(f.to) }),
      },
    }),
  };
}

// Boshqa sahifalardan (bosh sahifa, PNL, byudjet) Tranzaksiyalarga filtr bilan havola
export function transactionsHref(locale: string, f: TxFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(f)) if (value) params.set(key, value);
  const qs = params.toString();
  return `/${locale}/transactions${qs ? `?${qs}` : ''}`;
}
