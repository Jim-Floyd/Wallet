'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { WALLET_ICON_KEYS } from '@/lib/wallet-icons';

export type WalletState = { error?: string; success?: boolean } | null;

// Faqat ro'yxatdagi ikonka kalitlari saqlanadi; bo'sh yoki noma'lum — null (valyuta bayrog'i)
function parseIcon(formData: FormData): string | null {
  const icon = formData.get('icon') as string | null;
  return icon && WALLET_ICON_KEYS.includes(icon) ? icon : null;
}

export async function addWallet(_: WalletState, formData: FormData): Promise<WalletState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const currency = (formData.get('currency') as string) || 'UZS';
  const balance = parseFloat((formData.get('balance') as string) || '0') || 0;
  const color = (formData.get('color') as string) || null;
  const icon = parseIcon(formData);

  if (!name) return { error: 'Hamyon nomi kiritilishi shart' };

  await prisma.wallet.create({
    data: { userId: user.id, name, currency, balance, color, icon },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteWallet(_: WalletState, formData: FormData): Promise<WalletState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const id = formData.get('id') as string;
  const wallet = await prisma.wallet.findFirst({ where: { id, userId: user.id } });
  if (!wallet) return { error: 'Hamyon topilmadi' };
  if (wallet.isDefault) return { error: "Asosiy hamyonni o'chirish mumkin emas" };

  // O'tkazmalar boshqa hamyon balansiga ham ta'sir qilgan — ularni jimgina o'chirib bo'lmaydi
  const transferCount = await prisma.transaction.count({
    where: { type: 'TRANSFER', OR: [{ walletId: id }, { toWalletId: id }] },
  });
  if (transferCount > 0) {
    return {
      error: `Bu hamyon ${transferCount} ta o'tkazmada ishtirok etgan. Avval ularni Tranzaksiyalar sahifasida o'chiring.`,
    };
  }

  // Qarz yozuvlari qarz qoldig'ini hisoblaydi — ularni ham jimgina o'chirib bo'lmaydi
  const debtTxCount = await prisma.transaction.count({ where: { walletId: id, debtId: { not: null } } });
  if (debtTxCount > 0) {
    return {
      error: `Bu hamyonda ${debtTxCount} ta qarz yozuvi bor. Avval ularni Qarzlar sahifasida o'chiring.`,
    };
  }

  // Kirim/chiqimlar faqat shu hamyonga tegishli — hamyon bilan birga o'chadi
  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { walletId: id, userId: user.id } }),
    prisma.wallet.delete({ where: { id } }),
  ]);
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
  const icon = parseIcon(formData);
  const makeDefault = formData.get('makeDefault') === 'on';
  if (!name) return { error: 'Hamyon nomi kiritilishi shart' };

  const wallet = await prisma.wallet.findFirst({ where: { id, userId: user.id } });
  if (!wallet) return { error: 'Hamyon topilmadi' };

  await prisma.$transaction([
    // Asosiy hamyon bitta bo'ladi: avvalgisidan belgi olinadi
    ...(makeDefault && !wallet.isDefault
      ? [prisma.wallet.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } })]
      : []),
    prisma.wallet.update({
      where: { id },
      data: { name, color, icon, ...(makeDefault && { isDefault: true }) },
    }),
  ]);
  revalidatePath('/', 'layout');
  return { success: true };
}
