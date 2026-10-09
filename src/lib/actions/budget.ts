'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';

export type BudgetState = { error?: string; success?: boolean } | null;

export async function upsertBudget(_: BudgetState, formData: FormData): Promise<BudgetState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const category = (formData.get('category') as string).trim();
  const amount = parseFloat(formData.get('amount') as string);
  const currency = formData.get('currency') as string;
  const month = parseInt(formData.get('month') as string);
  const year = parseInt(formData.get('year') as string);
  // Necha oyga: tanlangan oydan boshlab ketma-ket oylarga bir xil limit (har oy alohida yozuv)
  const span = Math.min(Math.max(parseInt((formData.get('span') as string) || '1') || 1, 1), 12);

  if (!category) return { error: t('categoryRequired') };
  if (!amount || amount <= 0) return { error: t('amountPositive') };
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) return { error: t('invalidDate') };

  const periods = Array.from({ length: span }, (_, i) => ({
    month: ((month - 1 + i) % 12) + 1,
    year: year + Math.floor((month - 1 + i) / 12),
  }));
  // O'sha oylarda shu kategoriya va valyutaga byudjet bo'lsa — limiti yangilanadi
  const existing = await prisma.budget.findMany({
    where: { userId: user.id, category, currency, OR: periods },
  });
  const existingId = (p: { month: number; year: number }) =>
    existing.find(b => b.month === p.month && b.year === p.year)?.id;

  await prisma.$transaction(periods.map((p) => {
    const id = existingId(p);
    return id
      ? prisma.budget.update({ where: { id }, data: { amount } })
      : prisma.budget.create({ data: { userId: user.id, category, amount, currency, month: p.month, year: p.year } });
  }));

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteBudget(_: BudgetState, formData: FormData): Promise<BudgetState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const id = formData.get('id') as string;
  await prisma.budget.deleteMany({ where: { id, userId: user.id } });

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteBudgetAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const id = formData.get('id') as string;
  await prisma.budget.deleteMany({ where: { id, userId: user.id } });

  revalidatePath('/', 'layout');
}
