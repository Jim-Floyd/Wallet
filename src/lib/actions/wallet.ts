'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export type WalletState = { error?: string; success?: boolean } | null;

export async function addWallet(_: WalletState, formData: FormData): Promise<WalletState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const currency = (formData.get('currency') as string) || 'UZS';
  const balance = parseFloat((formData.get('balance') as string) || '0') || 0;
  const color = (formData.get('color') as string) || null;

  if (!name) return { error: 'Hamyon nomi kiritilishi shart' };

  await prisma.wallet.create({
    data: { userId: user.id, name, currency, balance, color },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteWallet(_: WalletState, formData: FormData): Promise<WalletState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const id = formData.get('id') as string;
  const wallet = await prisma.wallet.findUnique({ where: { id, userId: user.id } });
  if (wallet?.isDefault) return { error: "Asosiy hamyonni o'chirish mumkin emas" };
  await prisma.wallet.delete({ where: { id, userId: user.id } });
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateWallet(_: WalletState, formData: FormData): Promise<WalletState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const color = (formData.get('color') as string) || null;
  if (!name) return { error: 'Hamyon nomi kiritilishi shart' };
  await prisma.wallet.update({ where: { id, userId: user.id }, data: { name, color } });
  revalidatePath('/', 'layout');
  return { success: true };
}
