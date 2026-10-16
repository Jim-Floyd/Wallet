import { prisma } from '@/lib/prisma';

// Investitsiya hisobi (INVESTMENT turidagi hamyon):
//  - kiritish   — oddiy o'tkazma hamyondan investitsiyaga (xarajat emas, oylik statistikaga kirmaydi);
//  - daromad    — INCOME "Investitsiya daromadi"; investitsiyaning o'zida qolsa walletId = investitsiya,
//                 boshqa hamyonga olinsa walletId = o'sha hamyon, toWalletId = investitsiya (bog'lash uchun;
//                 INCOME uchun toWalletId balansga ta'sir qilmaydi — balanceEffects faqat walletId'ni ishlatadi);
//  - sotish     — tannarx qismi o'tkazma bo'lib qaytadi, ortig'i — daromad, kami — zarar (EXPENSE investitsiyadan);
//  - joriy qiymat — Wallet.valuationGain (joriy − balans), daromadga kirmaydi.
export const INVESTMENT_PROFIT = 'Investitsiya daromadi';
export const INVESTMENT_LOSS = 'Investitsiya zarari';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type InvestmentSummary = {
  book: number; // hisobdagi qiymat (balans)
  invested: number; // sof kiritilgan: balans − ichida qoldirilgan daromad
  market: number; // joriy qiymat: balans + qayta baholash
  gain: number; // qayta baholash (realizatsiya qilinmagan)
  earned: number; // olingan daromad − zarar (realizatsiya qilingan)
  result: number; // jami natija: earned + gain
  resultPct: number | null; // natija / kiritilgan
  valuedAt: Date | null;
};

type InvestmentWallet = { id: string; balance: { toString(): string } | number; valuationGain: { toString(): string } | number; valuedAt: Date | null };

// Investitsiya hamyonlari bo'yicha ko'rsatkichlar (bir nechta hamyon uchun bitta so'rovlar to'plami)
export async function investmentSummaries(userId: string, wallets: InvestmentWallet[]) {
  const ids = wallets.map(w => w.id);
  const result = new Map<string, InvestmentSummary>();
  if (ids.length === 0) return result;

  const [inside, linked, losses] = await Promise.all([
    // Investitsiyaning o'zida qolgan daromad (qayta investitsiya) — balans ichida
    prisma.transaction.groupBy({
      by: ['walletId'],
      where: { userId, type: 'INCOME', walletId: { in: ids } },
      _sum: { amount: true },
    }),
    // Boshqa hamyonga olingan daromad (toWalletId bilan bog'langan)
    prisma.transaction.groupBy({
      by: ['toWalletId'],
      where: { userId, type: 'INCOME', toWalletId: { in: ids } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['walletId'],
      where: { userId, type: 'EXPENSE', category: INVESTMENT_LOSS, walletId: { in: ids } },
      _sum: { amount: true },
    }),
  ]);
  const byId = (rows: { id: string | null; amount: unknown }[]) => {
    const map = new Map<string, number>();
    for (const r of rows) if (r.id) map.set(r.id, (map.get(r.id) ?? 0) + Number(r.amount ?? 0));
    return map;
  };
  const reinvestedBy = byId(inside.map(r => ({ id: r.walletId, amount: r._sum.amount })));
  const paidOutBy = byId(linked.map(r => ({ id: r.toWalletId, amount: r._sum.amount })));
  const lostBy = byId(losses.map(r => ({ id: r.walletId, amount: r._sum.amount })));

  for (const w of wallets) {
    const book = Number(w.balance);
    const gain = Number(w.valuationGain);
    const reinvested = reinvestedBy.get(w.id) ?? 0;
    const paidOut = paidOutBy.get(w.id) ?? 0;
    const lost = lostBy.get(w.id) ?? 0;
    const invested = round2(book - reinvested);
    const earned = round2(reinvested + paidOut - lost);
    const res = round2(earned + gain);
    result.set(w.id, {
      book, invested, market: round2(book + gain), gain, earned, result: res,
      resultPct: invested > 0 ? (res / invested) * 100 : null,
      valuedAt: w.valuedAt,
    });
  }
  return result;
}
