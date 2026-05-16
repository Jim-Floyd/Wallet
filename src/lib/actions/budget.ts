'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export type BudgetState = { error?: string; success?: boolean } | null;

export async function upsertBudget(_: BudgetState, formData: FormData): Promise<BudgetState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const category = (formData.get('category') as string).trim();
  const amount = parseFloat(formData.get('amount') as string);
  const currency = formData.get('currency') as string;
  const month = parseInt(formData.get('month') as string);
  const year = parseInt(formData.get('year') as string);

  if (!category) return { error: 'Kategoriya kiritilishi shart' };
  if (!amount || amount <= 0) return { error: 'Miqdor 0 dan katta bo\'lishi kerak' };

  const existing = await prisma.budget.findFirst({
    where: { userId: user.id, category, month, year, currency },
  });

  if (existing) {
    await prisma.budget.update({ where: { id: existing.id }, data: { amount } });
  } else {
    await prisma.budget.create({ data: { userId: user.id, category, amount, currency, month, year } });
  }

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
