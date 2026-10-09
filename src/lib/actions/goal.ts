'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import { dayStart } from '@/lib/days';

export type GoalState = { error?: string; success?: boolean } | null;

const CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB'];

async function getUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Muddat: "YYYY-MM-DD" (Toshkent kuni boshi) yoki bo'sh
function parseDeadline(formData: FormData): Date | null | { error: string } {
  const value = formData.get('deadline') as string | null;
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: 'invalidDueDate' };
  return dayStart(value);
}

// Maqsad: nomi, maqsad summasi, hozir yig'ilgani, muddat. Hamyonlarga bog'lanmaydi —
// yig'ilgan summa qo'lda yuritiladi (contributeGoal)
function parseGoalFields(formData: FormData) {
  return {
    name: ((formData.get('name') as string) ?? '').trim(),
    targetAmount: parseFloat(formData.get('targetAmount') as string),
    currentAmount: parseFloat((formData.get('currentAmount') as string) || '0') || 0,
  };
}

export async function addGoal(_: GoalState, formData: FormData): Promise<GoalState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const { name, targetAmount, currentAmount } = parseGoalFields(formData);
  const currency = formData.get('currency') as string;
  if (!name) return { error: t('goalNameRequired') };
  if (!targetAmount || isNaN(targetAmount) || targetAmount <= 0) return { error: t('amountPositive') };
  if (currentAmount < 0) return { error: t('invalidAmount') };
  if (!CURRENCIES.includes(currency)) return { error: t('selectCurrency') };
  const deadline = parseDeadline(formData);
  if (deadline && !(deadline instanceof Date)) return { error: t(deadline.error) };

  await prisma.goal.create({ data: { userId, name, targetAmount, currentAmount, currency, deadline } });

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateGoal(_: GoalState, formData: FormData): Promise<GoalState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('id') as string;
  const { name, targetAmount, currentAmount } = parseGoalFields(formData);
  if (!name) return { error: t('goalNameRequired') };
  if (!targetAmount || isNaN(targetAmount) || targetAmount <= 0) return { error: t('amountPositive') };
  if (currentAmount < 0) return { error: t('invalidAmount') };
  const deadline = parseDeadline(formData);
  if (deadline && !(deadline instanceof Date)) return { error: t(deadline.error) };

  const updated = await prisma.goal.updateMany({
    where: { id, userId },
    data: { name, targetAmount, currentAmount, deadline },
  });
  if (updated.count === 0) return { error: t('recordNotFound') };

  revalidatePath('/', 'layout');
  return { success: true };
}

// Yig'ilgan summaga qo'shish ("add") yoki undan olish ("withdraw"); 0 dan pastga tushmaydi
export async function contributeGoal(_: GoalState, formData: FormData): Promise<GoalState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('id') as string;
  const amount = parseFloat(formData.get('amount') as string);
  const direction = formData.get('direction') === 'withdraw' ? -1 : 1;
  if (!amount || isNaN(amount) || amount <= 0) return { error: t('amountPositive') };

  const goal = await prisma.goal.findFirst({ where: { id, userId } });
  if (!goal) return { error: t('recordNotFound') };

  const next = Math.max(Math.round((Number(goal.currentAmount) + direction * amount) * 100) / 100, 0);
  await prisma.goal.update({ where: { id }, data: { currentAmount: next } });

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteGoal(_: GoalState, formData: FormData): Promise<GoalState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const id = formData.get('id') as string;
  await prisma.goal.deleteMany({ where: { id, userId } });

  revalidatePath('/', 'layout');
  return { success: true };
}
