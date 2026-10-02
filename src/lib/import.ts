import * as XLSX from 'xlsx';
import { dayStart } from '@/lib/days';
import { CURRENCY_RANK, transferToAmount } from '@/lib/currency';

// Excel/CSV importi. Ustunlar tartibi shablon bilan bir xil (sarlavha matni tekshirilmaydi — har qanday tilda bo'lishi mumkin):
// Sana | Tur | Hamyon | Summa | Kategoriya | Izoh | Qabul qiluvchi hamyon | Kurs

export type ImportTxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export type ImportContext = {
  wallets: { id: string; name: string; currency: string }[];
  typeWords: Map<string, ImportTxType>;      // normKey(so'z) → tur
  categoryAliases: Map<string, string>;      // normKey(nom/tarjima) → bazadagi nom
  today: string;                             // dayKey
};

// "errors" emas, "import" nomlar fazosidagi kalit + qiymatlar
export type RowError = { row: number; key: string; values?: Record<string, string> };

export type ImportedTx = {
  type: ImportTxType;
  walletId: string;
  toWalletId: string | null;
  amount: number;
  currency: string;
  toAmount: number | null;
  toCurrency: string | null;
  rate: number | null;
  category: string | null;
  description: string | null;
  date: Date;
};

// Solishtirish kaliti: kichik harf, turli apostroflar bitta, ortiqcha bo'sh joylarsiz
export function normKey(s: string) {
  return s.toLowerCase().replace(/[ʻʼ’‘`´]/g, "'").replace(/\s+/g, ' ').trim();
}

function cellText(v: unknown) {
  return v == null ? '' : String(v).trim();
}

// Sana: Excel seriya raqami yoki "30.09.2026" / "30/09/2026" / "2026-09-30" matni → "YYYY-MM-DD"
function parseDateCell(v: unknown): string | null {
  let y: number, m: number, d: number;
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v);
    if (!p) return null;
    ({ y, m, d } = p);
  } else {
    const s = cellText(v);
    let match = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (match) [d, m, y] = [+match[1], +match[2], +match[3]];
    else if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [y, m, d] = [+match[1], +match[2], +match[3]];
    else return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Son: Excel soni yoki "1 500 000", "1 500 000,50", "1,500,000.50", "1.500.000" matni
function parseNumberCell(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = cellText(v).replace(/[\s  ]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // Ikkalasi bor — oxirgisi kasr ajratgich, ikkinchisi minglik
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (s.split('.').length > 2) {
    s = s.replace(/\./g, '');
  }
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

// Birinchi qator sarlavha bo'lsa (sana emas) — o'tkazib yuboriladi. Bo'sh qatorlar hisobga olinmaydi.
export function dataRows(rows: unknown[][]) {
  const numbered = rows.map((cells, i) => ({ row: i + 1, cells }));
  const withoutHeader = numbered.length > 0 && parseDateCell(numbered[0].cells[0]) == null ? numbered.slice(1) : numbered;
  return withoutHeader.filter(({ cells }) => cells.slice(0, 8).some(c => cellText(c) !== ''));
}

export function parseImportRows(rows: { row: number; cells: unknown[] }[], ctx: ImportContext) {
  const errors: RowError[] = [];
  const txs: ImportedTx[] = [];
  const newCategories = new Map<string, string>(); // normKey → faylda birinchi uchragan yozilishi

  // Nomi takrorlanadigan hamyonlar — qaysi biri ekanini aniqlab bo'lmaydi
  const walletsByName = new Map<string, ImportContext['wallets']>();
  for (const w of ctx.wallets) {
    const key = normKey(w.name);
    walletsByName.set(key, [...(walletsByName.get(key) ?? []), w]);
  }

  for (const { row, cells } of rows) {
    const [dateCell, typeCell, walletCell, amountCell, categoryCell, noteCell, toWalletCell, rateCell] = cells;
    const fail = (key: string, values?: Record<string, string>) => { errors.push({ row, key, values }); };

    const date = parseDateCell(dateCell);
    if (!date) { fail('errDate', { value: cellText(dateCell) }); continue; }
    if (date > ctx.today) { fail('errFutureDate', { value: cellText(dateCell) }); continue; }

    const type = ctx.typeWords.get(normKey(cellText(typeCell)));
    if (!type) { fail('errType', { value: cellText(typeCell) }); continue; }

    const findWallet = (cell: unknown) => {
      const matches = walletsByName.get(normKey(cellText(cell))) ?? [];
      if (matches.length === 0) { fail('errWallet', { value: cellText(cell) }); return null; }
      if (matches.length > 1) { fail('errWalletAmbiguous', { value: cellText(cell) }); return null; }
      return matches[0];
    };
    const wallet = findWallet(walletCell);
    if (!wallet) continue;

    const rawAmount = parseNumberCell(amountCell);
    const amount = rawAmount == null ? 0 : round(rawAmount, 2);
    if (amount <= 0) { fail('errAmount', { value: cellText(amountCell) }); continue; }

    const description = cellText(noteCell) || null;
    // Kun o'rtasi (Toshkent) — kun chegarasidan siljimasligi uchun
    const txDate = new Date(dayStart(date).getTime() + 12 * 60 * 60 * 1000);

    if (type !== 'TRANSFER') {
      const categoryText = cellText(categoryCell);
      let category: string | null = null;
      if (categoryText) {
        const key = normKey(categoryText);
        category = ctx.categoryAliases.get(key) ?? newCategories.get(key) ?? categoryText;
        if (!ctx.categoryAliases.has(key) && !newCategories.has(key)) newCategories.set(key, categoryText);
      }
      txs.push({
        type, walletId: wallet.id, toWalletId: null, amount, currency: wallet.currency,
        toAmount: null, toCurrency: null, rate: null, category, description, date: txDate,
      });
      continue;
    }

    if (!cellText(toWalletCell)) { fail('errToWallet'); continue; }
    const toWallet = findWallet(toWalletCell);
    if (!toWallet) continue;
    if (toWallet.id === wallet.id) { fail('errSameWallet'); continue; }

    if (wallet.currency === toWallet.currency) {
      txs.push({
        type, walletId: wallet.id, toWalletId: toWallet.id, amount, currency: wallet.currency,
        toAmount: null, toCurrency: null, rate: null, category: null, description, date: txDate,
      });
      continue;
    }

    const rawRate = parseNumberCell(rateCell);
    const rate = rawRate == null ? 0 : round(rawRate, 6);
    if (rate <= 0) {
      const [higher, lower] = (CURRENCY_RANK[wallet.currency] ?? 1) >= (CURRENCY_RANK[toWallet.currency] ?? 1)
        ? [wallet.currency, toWallet.currency] : [toWallet.currency, wallet.currency];
      fail('errRate', { higher, lower });
      continue;
    }
    txs.push({
      type, walletId: wallet.id, toWalletId: toWallet.id, amount, currency: wallet.currency,
      toAmount: round(transferToAmount(amount, wallet.currency, toWallet.currency, rate), 2),
      toCurrency: toWallet.currency, rate, category: null, description, date: txDate,
    });
  }

  return { txs, errors, newCategories: Array.from(newCategories.values()) };
}
