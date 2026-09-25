import { prisma } from '@/lib/prisma';
import type { TransactionType } from '@/generated/prisma/client';

type Amount = number | { toString(): string };

export type BalanceTx = {
  type: TransactionType;
  walletId: string;
  toWalletId: string | null;
  amount: Amount;
  toAmount: Amount | null;
};

export type BalanceEffect = { walletId: string; delta: number };

// Tranzaksiyaning hamyon balanslariga ta'siri
export function balanceEffects(tx: BalanceTx): BalanceEffect[] {
  const amount = Number(tx.amount);
  switch (tx.type) {
    case 'INCOME':
    case 'DEBT_IN':
      return [{ walletId: tx.walletId, delta: amount }];
    case 'EXPENSE':
    case 'DEBT_OUT':
      return [{ walletId: tx.walletId, delta: -amount }];
    case 'TRANSFER':
      return [
        { walletId: tx.walletId, delta: -amount },
        { walletId: tx.toWalletId!, delta: tx.toAmount != null ? Number(tx.toAmount) : amount },
      ];
  }
}

export function reverseEffects(tx: BalanceTx): BalanceEffect[] {
  return balanceEffects(tx).map(e => ({ ...e, delta: -e.delta }));
}

// Ta'sirlarni hamyon bo'yicha jamlab, prisma.$transaction ga beriladigan update'lar ro'yxatini qaytaradi
export function balanceUpdates(effects: BalanceEffect[]) {
  const merged = new Map<string, number>();
  for (const { walletId, delta } of effects) {
    merged.set(walletId, (merged.get(walletId) ?? 0) + delta);
  }
  return Array.from(merged)
    .filter(([, delta]) => delta !== 0)
    .map(([id, delta]) => prisma.wallet.update({ where: { id }, data: { balance: { increment: delta } } }));
}

export const isDebtType = (type: TransactionType) => type === 'DEBT_IN' || type === 'DEBT_OUT';
