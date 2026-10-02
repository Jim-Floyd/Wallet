// Kattaroq rank — kuchliroq valyuta. Kurs doim "1 kuchli valyuta = rate kuchsiz" ko'rinishida kiritiladi
export const CURRENCY_RANK: Record<string, number> = { UZS: 1, RUB: 2, USD: 3, EUR: 4 };

// O'tkazmada qabul qiluvchi hamyonga tushadigan summa: kuchli → kuchsiz — ko'paytiriladi, kuchsiz → kuchli — bo'linadi
export function transferToAmount(amount: number, fromCurrency: string, toCurrency: string, rate: number) {
  const fromRank = CURRENCY_RANK[fromCurrency] ?? 1;
  const toRank = CURRENCY_RANK[toCurrency] ?? 1;
  return fromRank >= toRank ? amount * rate : amount / rate;
}
