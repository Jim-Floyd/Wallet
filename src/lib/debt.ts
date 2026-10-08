import type { DebtType, TransactionType } from '@/generated/prisma/client';
import type { Translate } from '@/lib/intl';

// Qarz berilganda/olinganda hamyon harakati
export function initialTxType(type: DebtType): TransactionType {
  return type === 'LENT' ? 'DEBT_OUT' : 'DEBT_IN';
}

// Qarz qaytarilganda/to'langanda hamyon harakati
export function repayTxType(type: DebtType): TransactionType {
  return type === 'LENT' ? 'DEBT_IN' : 'DEBT_OUT';
}

// Tranzaksiyalar ro'yxatida qarz yozuvining nomi. t — "debts" nomlar fazosi
export function debtTxLabel(txType: TransactionType, debt: { type: DebtType; person: string }, t: Translate) {
  const initial = txType === initialTxType(debt.type);
  const key = debt.type === 'LENT'
    ? (initial ? 'txLent' : 'txLentRepaid')
    : (initial ? 'txBorrowed' : 'txBorrowedRepaid');
  return t(key, { person: debt.person });
}

// URL dagi ?type= filtrini Prisma shartiga aylantiradi ("DEBT" — ikkala qarz turi)
export function txTypeWhere(type: string | null | undefined) {
  if (!type) return {};
  if (type === 'DEBT') return { type: { in: ['DEBT_IN', 'DEBT_OUT'] as TransactionType[] } };
  return { type: type as TransactionType };
}

const round2 =(n: number) => Math.round(n * 100) / 100;

type DebtLike = {
  type: DebtType;
  amount: number | { toString(): string };
  transactions: { type: TransactionType; amount: number | { toString(): string } }[];
};

// Tranzaksiya oynasidagi "Qaytarish" uchun ochiq qarzlar ro'yxati
export type OpenDebtOption = { id: string; type: DebtType; person: string; currency: string; remaining: number };

export function openDebtOptions(debts: (DebtLike & { id: string; person: string; currency: string })[]): OpenDebtOption[] {
  return debts
    .map(d => ({ d, progress: debtProgress(d) }))
    .filter(({ progress }) => !progress.closed)
    .map(({ d, progress }) => ({ id: d.id, type: d.type, person: d.person, currency: d.currency, remaining: progress.remaining }))
    .sort((a, b) => a.person.localeCompare(b.person));
}

export function debtProgress(debt: DebtLike) {
  const amount = Number(debt.amount);
  const repay = repayTxType(debt.type);
  const paid = round2(
    debt.transactions.filter(t => t.type === repay).reduce((s, t) => s + Number(t.amount), 0),
  );
  const remaining = round2(Math.max(amount - paid, 0));
  return { amount, paid, remaining, closed: remaining <= 0 };
}
