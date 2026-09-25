'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { balanceEffects, balanceUpdates, isDebtType, reverseEffects } from '@/lib/balance';
import { parseFormDate } from '@/lib/form-date';
import { dayKey, dayStart } from '@/lib/days';
import { isFrequency, occurrenceDate } from '@/lib/recurring';

export type TransactionState = { error?: string; success?: boolean } | null;

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

const CURRENCY_RANK: Record<string, number> = { UZS: 1, RUB: 2, USD: 3, EUR: 4 };

type TxData = {
  walletId: string;
  toWalletId: string | null;
  amount: number;
  currency: string;
  toAmount: number | null;
  toCurrency: string | null;
  rate: number | null;
  category: string | null;
  description: string | null;
  date?: Date;
};

const DEBT_TX_ERROR = "Qarz tranzaksiyasini Qarzlar sahifasida boshqaring";

async function parseTransactionForm(
  formData: FormData,
  userId: string,
  type: TxType,
): Promise<TxData | { error: string }> {
  const walletId = formData.get('walletId') as string;
  const amount = parseFloat(formData.get('amount') as string);
  const category = (formData.get('category') as string) || null;
  const description = (formData.get('description') as string) || null;

  if (!walletId || !type || !amount || isNaN(amount) || amount <= 0) {
    return { error: 'Hamyon, tur va miqdor kiritilishi shart' };
  }

  const date = parseFormDate(formData);
  if (date && !(date instanceof Date)) return date;

  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId } });
  if (!wallet) return { error: 'Hamyon topilmadi' };

  if (type !== 'TRANSFER') {
    return {
      walletId, toWalletId: null, amount, currency: wallet.currency,
      toAmount: null, toCurrency: null, rate: null, category, description, date,
    };
  }

  const toWalletId = formData.get('toWalletId') as string;
  if (!toWalletId) return { error: "Qabul qiluvchi hamyon tanlang" };
  if (toWalletId === walletId) return { error: "Bir xil hamyonga o'tkazib bo'lmaydi" };

  const toWallet = await prisma.wallet.findFirst({ where: { id: toWalletId, userId } });
  if (!toWallet) return { error: 'Qabul qiluvchi hamyon topilmadi' };

  if (wallet.currency === toWallet.currency) {
    return {
      walletId, toWalletId, amount, currency: wallet.currency,
      toAmount: null, toCurrency: null, rate: null, category: null, description, date,
    };
  }

  const rate = parseFloat(formData.get('rate') as string);
  if (!rate || rate <= 0) return { error: 'Valyuta kursini kiriting' };

  const fromRank = CURRENCY_RANK[wallet.currency] ?? 1;
  const toRank = CURRENCY_RANK[toWallet.currency] ?? 1;
  const toAmount = fromRank >= toRank ? amount * rate : amount / rate;

  return {
    walletId, toWalletId, amount, currency: wallet.currency,
    toAmount, toCurrency: toWallet.currency, rate, category: null, description, date,
  };
}

export async function addTransaction(_: TransactionState, formData: FormData): Promise<TransactionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const type = formData.get('type') as TxType;
  const data = await parseTransactionForm(formData, user.id, type);
  if ('error' in data) return { error: data.error };

  // Takrorlash (faqat kirim/chiqim): qoida yaratiladi, birinchi yozuv unga bog'lanadi
  const repeat = formData.get('repeat');
  const txData = { ...data, userId: user.id, type };

  if (isFrequency(repeat) && type !== 'TRANSFER') {
    const startDate = dayStart(dayKey(data.date ?? new Date()));
    await prisma.$transaction([
      prisma.recurringRule.create({
        data: {
          userId: user.id,
          walletId: data.walletId,
          type,
          amount: data.amount,
          currency: data.currency,
          category: data.category,
          description: data.description,
          frequency: repeat,
          startDate,
          count: 1,
          nextDate: occurrenceDate(startDate, repeat, 1),
          transactions: { create: txData },
        },
      }),
      ...balanceUpdates(balanceEffects(txData)),
    ]);
  } else {
    await prisma.$transaction([
      prisma.transaction.create({ data: txData }),
      ...balanceUpdates(balanceEffects(txData)),
    ]);
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

// Takrorni to'xtatish: qoida o'chadi, oldin yaratilgan yozuvlar qoladi (recurringId → null)
export async function deleteRecurring(_: TransactionState, formData: FormData): Promise<TransactionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const id = formData.get('id') as string;
  const { count } = await prisma.recurringRule.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return { error: 'Takror topilmadi' };

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateTransaction(_: TransactionState, formData: FormData): Promise<TransactionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const id = formData.get('id') as string;
  const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: 'Tranzaksiya topilmadi' };
  if (isDebtType(existing.type)) return { error: DEBT_TX_ERROR };
  const type = existing.type as TxType;

  // Turi o'zgarmaydi — faqat qiymatlar tahrirlanadi
  const data = await parseTransactionForm(formData, user.id, type);
  if ('error' in data) return { error: data.error };

  await prisma.$transaction([
    prisma.transaction.update({ where: { id }, data }),
    ...balanceUpdates([...reverseEffects(existing), ...balanceEffects({ ...data, type })]),
  ]);

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteTransaction(_: TransactionState, formData: FormData): Promise<TransactionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const id = formData.get('id') as string;
  const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: 'Tranzaksiya topilmadi' };
  if (isDebtType(existing.type)) return { error: DEBT_TX_ERROR };

  await prisma.$transaction([
    prisma.transaction.delete({ where: { id } }),
    ...balanceUpdates(reverseEffects(existing)),
  ]);

  revalidatePath('/', 'layout');
  return { success: true };
}
