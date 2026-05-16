'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export type TransactionState = { error?: string; success?: boolean } | null;

const CURRENCY_RANK: Record<string, number> = { UZS: 1, RUB: 2, USD: 3, EUR: 4 };

export async function addTransaction(_: TransactionState, formData: FormData): Promise<TransactionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const walletId = formData.get('walletId') as string;
  const type = formData.get('type') as 'INCOME' | 'EXPENSE' | 'TRANSFER';
  const amount = parseFloat(formData.get('amount') as string);
  const category = (formData.get('category') as string) || null;
  const description = (formData.get('description') as string) || null;

  if (!walletId || !type || !amount || isNaN(amount) || amount <= 0) {
    return { error: 'Hamyon, tur va miqdor kiritilishi shart' };
  }

  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId: user.id } });
  if (!wallet) return { error: 'Hamyon topilmadi' };

  if (type === 'TRANSFER') {
    const toWalletId = formData.get('toWalletId') as string;
    if (!toWalletId) return { error: "Qabul qiluvchi hamyon tanlang" };
    if (toWalletId === walletId) return { error: "Bir xil hamyonga o'tkazib bo'lmaydi" };

    const toWallet = await prisma.wallet.findFirst({ where: { id: toWalletId, userId: user.id } });
    if (!toWallet) return { error: 'Qabul qiluvchi hamyon topilmadi' };

    let toAmount = amount;
    let savedRate: number | null = null;

    if (wallet.currency !== toWallet.currency) {
      const rate = parseFloat(formData.get('rate') as string);
      if (!rate || rate <= 0) return { error: 'Valyuta kursini kiriting' };

      const fromRank = CURRENCY_RANK[wallet.currency] ?? 1;
      const toRank = CURRENCY_RANK[toWallet.currency] ?? 1;

      if (fromRank >= toRank) {
        toAmount = amount * rate;
      } else {
        toAmount = amount / rate;
      }
      savedRate = rate;
    }

    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId: user.id,
          walletId,
          toWalletId,
          type: 'TRANSFER',
          amount,
          currency: wallet.currency,
          toAmount: wallet.currency !== toWallet.currency ? toAmount : null,
          toCurrency: wallet.currency !== toWallet.currency ? toWallet.currency : null,
          rate: savedRate,
          description: description || null,
        },
      }),
      prisma.wallet.update({
        where: { id: walletId },
        data: { balance: { decrement: amount } },
      }),
      prisma.wallet.update({
        where: { id: toWalletId },
        data: { balance: { increment: toAmount } },
      }),
    ]);
  } else {
    const balanceDelta = type === 'INCOME' ? amount : -amount;

    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId: user.id,
          walletId,
          type,
          amount,
          currency: wallet.currency,
          category,
          description,
        },
      }),
      prisma.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: balanceDelta } },
      }),
    ]);
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
