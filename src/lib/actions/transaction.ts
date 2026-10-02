'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { balanceEffects, balanceUpdates, isDebtType, reverseEffects } from '@/lib/balance';
import { parseFormDate } from '@/lib/form-date';
import { dayKey, dayStart } from '@/lib/days';
import { isFrequency, occurrenceDate } from '@/lib/recurring';
import { getTranslations } from 'next-intl/server';
import { transferToAmount } from '@/lib/currency';

export type TransactionState = { error?: string; success?: boolean } | null;

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

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

// Xatoda "errors" tarjima kalitini qaytaradi — action uni tarjima qiladi
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
    return { error: 'requiredTxFields' };
  }

  const date = parseFormDate(formData);
  if (date && !(date instanceof Date)) return date;

  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId } });
  if (!wallet) return { error: 'walletNotFound' };

  if (type !== 'TRANSFER') {
    return {
      walletId, toWalletId: null, amount, currency: wallet.currency,
      toAmount: null, toCurrency: null, rate: null, category, description, date,
    };
  }

  const toWalletId = formData.get('toWalletId') as string;
  if (!toWalletId) return { error: 'selectTargetWallet' };
  if (toWalletId === walletId) return { error: 'sameWallet' };

  const toWallet = await prisma.wallet.findFirst({ where: { id: toWalletId, userId } });
  if (!toWallet) return { error: 'targetWalletNotFound' };

  if (wallet.currency === toWallet.currency) {
    return {
      walletId, toWalletId, amount, currency: wallet.currency,
      toAmount: null, toCurrency: null, rate: null, category: null, description, date,
    };
  }

  const rate = parseFloat(formData.get('rate') as string);
  if (!rate || rate <= 0) return { error: 'enterRate' };

  const toAmount = transferToAmount(amount, wallet.currency, toWallet.currency, rate);

  return {
    walletId, toWalletId, amount, currency: wallet.currency,
    toAmount, toCurrency: toWallet.currency, rate, category: null, description, date,
  };
}

export async function addTransaction(_: TransactionState, formData: FormData): Promise<TransactionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const type = formData.get('type') as TxType;
  const data = await parseTransactionForm(formData, user.id, type);
  if ('error' in data) return { error: t(data.error) };

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

// Takrorni tahrirlash — faqat kelajakdagi yozuvlarga ta'sir qiladi (oldingilari va balans o'zgarmaydi).
// Davr yoki keyingi sana o'zgarsa, jadval shu sanadan qayta boshlanadi (startDate = yangi sana, count = 0).
export async function updateRecurring(_: TransactionState, formData: FormData): Promise<TransactionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('id') as string;
  const walletId = formData.get('walletId') as string;
  const amount = parseFloat(formData.get('amount') as string);
  const frequency = formData.get('frequency');
  const nextDateStr = formData.get('nextDate') as string;
  const today = formData.get('today') as string;
  const category = (formData.get('category') as string) || null;
  const description = ((formData.get('description') as string) ?? '').trim() || null;

  if (!amount || isNaN(amount) || amount <= 0) return { error: t('amountPositive') };
  if (!isFrequency(frequency)) return { error: t('selectFrequency') };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDateStr)) return { error: t('invalidNextDate') };
  if (today && nextDateStr < today) return { error: t('nextDatePast') };

  const rule = await prisma.recurringRule.findFirst({ where: { id, userId: user.id } });
  if (!rule) return { error: t('recurringNotFound') };

  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId: user.id } });
  if (!wallet) return { error: t('walletNotFound') };

  const reschedule = frequency !== rule.frequency || nextDateStr !== dayKey(rule.nextDate);
  const newStart = dayStart(nextDateStr);

  await prisma.recurringRule.update({
    where: { id },
    data: {
      walletId,
      currency: wallet.currency,
      amount,
      category,
      description,
      frequency,
      ...(reschedule && { startDate: newStart, count: 0, nextDate: newStart }),
    },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

// Takrorni to'xtatish: qoida o'chadi, oldin yaratilgan yozuvlar qoladi (recurringId → null)
export async function deleteRecurring(_: TransactionState, formData: FormData): Promise<TransactionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('id') as string;
  const { count } = await prisma.recurringRule.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return { error: t('recurringNotFound') };

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateTransaction(_: TransactionState, formData: FormData): Promise<TransactionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('id') as string;
  const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: t('transactionNotFound') };
  if (isDebtType(existing.type)) return { error: t('debtTxManagedElsewhere') };
  const type = existing.type as TxType;

  // Turi o'zgarmaydi — faqat qiymatlar tahrirlanadi
  const data = await parseTransactionForm(formData, user.id, type);
  if ('error' in data) return { error: t(data.error) };

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
  const t = await getTranslations('errors');

  const id = formData.get('id') as string;
  const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: t('transactionNotFound') };
  if (isDebtType(existing.type)) return { error: t('debtTxManagedElsewhere') };

  await prisma.$transaction([
    prisma.transaction.delete({ where: { id } }),
    ...balanceUpdates(reverseEffects(existing)),
  ]);

  revalidatePath('/', 'layout');
  return { success: true };
}
