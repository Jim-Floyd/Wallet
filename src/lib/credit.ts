type Amount = number | { toString(): string };

export type WalletKindValue = 'DEBIT' | 'CREDIT';

export function parseWalletKind(value: FormDataEntryValue | null): WalletKindValue {
  return value === 'CREDIT' ? 'CREDIT' : 'DEBIT';
}

// Kredit hamyon holati: qarz = manfiy qoldiq, mavjud = limit + qoldiq (limitdan oshsa manfiy).
// Debet hamyon yoki limitsiz kredit uchun null
export function creditInfo(w: { kind: WalletKindValue; creditLimit: Amount | null; balance: Amount }) {
  if (w.kind !== 'CREDIT' || w.creditLimit == null) return null;
  const limit = Number(w.creditLimit);
  const balance = Number(w.balance);
  const used = Math.max(-balance, 0);
  return { limit, used, available: limit + balance, usedPct: limit > 0 ? Math.min((used / limit) * 100, 100) : 0 };
}

// Tranzaksiya oynasiga uzatiladigan hamyon: kredit bo'lsa hozirgi mavjud mablag' (ogohlantirish uchun)
export function walletOption(w: { id: string; name: string; currency: string; kind: WalletKindValue; creditLimit: Amount | null; balance: Amount }) {
  return { id: w.id, name: w.name, currency: w.currency, available: creditInfo(w)?.available ?? null };
}
