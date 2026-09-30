'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import { balanceEffects, balanceUpdates, reverseEffects } from '@/lib/balance';
import { parseFormDate } from '@/lib/form-date';
import { debtProgress, initialTxType, repayTxType } from '@/lib/debt';

export type DebtState = { error?: string; success?: boolean } | null;

const CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB'];

async function getUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Muddat: "YYYY-MM-DD" yoki bo'sh
function parseDueDate(formData: FormData): Date | null | { error: string } {
  const due = formData.get('dueDate') as string | null;
  if (!due) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: 'invalidDueDate' };
  return new Date(`${due}T12:00:00`);
}

export async function addDebt(_: DebtState, formData: FormData): Promise<DebtState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const type = formData.get('type') as 'LENT' | 'BORROWED';
  const person = ((formData.get('person') as string) ?? '').trim();
  const phone = ((formData.get('phone') as string) ?? '').trim() || null;
  const amount = parseFloat(formData.get('amount') as string);
  const walletId = (formData.get('walletId') as string) || null;
  const description = ((formData.get('description') as string) ?? '').trim() || null;

  if (type !== 'LENT' && type !== 'BORROWED') return { error: t('selectDebtType') };
  if (!person) return { error: t('personRequired') };
  if (!amount || isNaN(amount) || amount <= 0) return { error: t('amountPositive') };

  const date = parseFormDate(formData);
  if (date && !(date instanceof Date)) return { error: t(date.error) };
  const dueDate = parseDueDate(formData);
  if (dueDate && !(dueDate instanceof Date)) return { error: t(dueDate.error) };

  // Hamyon tanlansa — pul haqiqatan harakatlanadi; tanlanmasa — faqat yozuv (masalan, eski qarz)
  let currency = formData.get('currency') as string;
  if (walletId) {
    const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId } });
    if (!wallet) return { error: t('walletNotFound') };
    currency = wallet.currency;
  } else if (!CURRENCIES.includes(currency)) {
    return { error: t('selectCurrency') };
  }

  const txType = initialTxType(type);

  await prisma.$transaction([
    prisma.debt.create({
      data: {
        userId, type, person, phone, amount, currency, dueDate, description,
        ...(date && { date }),
        ...(walletId && {
          transactions: {
            create: { userId, walletId, type: txType, amount, currency, description, ...(date && { date }) },
          },
        }),
      },
    }),
    ...(walletId
      ? balanceUpdates(balanceEffects({ type: txType, walletId, toWalletId: null, amount, toAmount: null }))
      : []),
  ]);

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateDebt(_: DebtState, formData: FormData): Promise<DebtState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('id') as string;
  const person = ((formData.get('person') as string) ?? '').trim();
  const phone = ((formData.get('phone') as string) ?? '').trim() || null;
  const description = ((formData.get('description') as string) ?? '').trim() || null;
  if (!person) return { error: t('personRequired') };

  const dueDate = parseDueDate(formData);
  if (dueDate && !(dueDate instanceof Date)) return { error: t(dueDate.error) };

  const debt = await prisma.debt.findFirst({ where: { id, userId }, include: { transactions: true } });
  if (!debt) return { error: t('debtNotFound') };

  // Boshlang'ich yozuv hamyonini almashtirish ('' — hamyonsiz, faqat yozuv)
  const txType = initialTxType(debt.type);
  const initial = debt.transactions.find(t => t.type === txType) ?? null;
  const newWalletId = (formData.get('walletId') as string) || null;
  const walletOps = [];

  if (newWalletId !== (initial?.walletId ?? null)) {
    if (newWalletId) {
      const wallet = await prisma.wallet.findFirst({ where: { id: newWalletId, userId } });
      if (!wallet) return { error: t('walletNotFound') };
      if (wallet.currency !== debt.currency) {
        return { error: t('walletCurrencyMismatch', { currency: debt.currency }) };
      }
    }

    const moved = newWalletId
      ? balanceEffects({ type: txType, walletId: newWalletId, toWalletId: null, amount: debt.amount, toAmount: null })
      : [];
    const effects = [...(initial ? reverseEffects(initial) : []), ...moved];

    if (initial && newWalletId) {
      walletOps.push(prisma.transaction.update({ where: { id: initial.id }, data: { walletId: newWalletId } }));
    } else if (initial) {
      walletOps.push(prisma.transaction.delete({ where: { id: initial.id } }));
    } else if (newWalletId) {
      walletOps.push(prisma.transaction.create({
        data: {
          userId, walletId: newWalletId, debtId: id, type: txType, amount: debt.amount,
          currency: debt.currency, description: debt.description, date: debt.date,
        },
      }));
    }
    walletOps.push(...balanceUpdates(effects));
  }

  await prisma.$transaction([
    prisma.debt.update({ where: { id }, data: { person, phone, dueDate, description } }),
    ...walletOps,
  ]);

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function addDebtPayment(_: DebtState, formData: FormData): Promise<DebtState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const debtId = formData.get('debtId') as string;
  const walletId = formData.get('walletId') as string;
  const amount = parseFloat(formData.get('amount') as string);
  const description = ((formData.get('description') as string) ?? '').trim() || null;

  if (!walletId) return { error: t('selectWallet') };
  if (!amount || isNaN(amount) || amount <= 0) return { error: t('amountPositive') };

  const date = parseFormDate(formData);
  if (date && !(date instanceof Date)) return { error: t(date.error) };

  const debt = await prisma.debt.findFirst({
    where: { id: debtId, userId },
    include: { transactions: { select: { type: true, amount: true } } },
  });
  if (!debt) return { error: t('debtNotFound') };

  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId } });
  if (!wallet) return { error: t('walletNotFound') };
  if (wallet.currency !== debt.currency) {
    return { error: t('walletCurrencyMismatch', { currency: debt.currency }) };
  }

  const { remaining } = debtProgress(debt);
  if (amount > remaining + 0.001) {
    return { error: t('paymentExceedsRemaining', { amount: remaining, currency: debt.currency }) };
  }

  const txType = repayTxType(debt.type);

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId, walletId, debtId, type: txType, amount, currency: debt.currency, description,
        ...(date && { date }),
      },
    }),
    ...balanceUpdates(balanceEffects({ type: txType, walletId, toWalletId: null, amount, toAmount: null })),
  ]);

  revalidatePath('/', 'layout');
  return { success: true };
}

// Qaytarish yozuvini o'chirish (boshlang'ich qarz tranzaksiyasi emas)
export async function deleteDebtPayment(_: DebtState, formData: FormData): Promise<DebtState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('id') as string;
  const tx = await prisma.transaction.findFirst({
    where: { id, userId, debtId: { not: null } },
    include: { debt: { select: { type: true } } },
  });
  if (!tx || !tx.debt) return { error: t('recordNotFound') };
  if (tx.type !== repayTxType(tx.debt.type)) {
    return { error: t('deleteInitialDebtTx') };
  }

  await prisma.$transaction([
    prisma.transaction.delete({ where: { id } }),
    ...balanceUpdates(reverseEffects(tx)),
  ]);

  revalidatePath('/', 'layout');
  return { success: true };
}

// Qarzni butunlay o'chirish: barcha bog'langan tranzaksiyalar o'chadi, balanslar qaytariladi
export async function deleteDebt(_: DebtState, formData: FormData): Promise<DebtState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('id') as string;
  const debt = await prisma.debt.findFirst({ where: { id, userId }, include: { transactions: true } });
  if (!debt) return { error: t('debtNotFound') };

  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { debtId: id, userId } }),
    prisma.debt.delete({ where: { id } }),
    ...balanceUpdates(debt.transactions.flatMap(reverseEffects)),
  ]);

  revalidatePath('/', 'layout');
  return { success: true };
}
