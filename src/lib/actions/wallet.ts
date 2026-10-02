'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import { WALLET_ICON_KEYS } from '@/lib/wallet-icons';
import { parseWalletKind, type WalletKindValue } from '@/lib/credit';

export type WalletState = { error?: string; success?: boolean } | null;

// Faqat ro'yxatdagi ikonka kalitlari saqlanadi; bo'sh yoki noma'lum — null (valyuta bayrog'i)
function parseIcon(formData: FormData): string | null {
  const icon = formData.get('icon') as string | null;
  return icon && WALLET_ICON_KEYS.includes(icon) ? icon : null;
}

// Kredit hamyonda limit majburiy va musbat; debetda doim null. Xatoda "errors" tarjima kaliti
function parseCredit(formData: FormData, kind: WalletKindValue): { creditLimit: number | null } | { error: string } {
  if (kind !== 'CREDIT') return { creditLimit: null };
  const creditLimit = parseFloat(formData.get('creditLimit') as string);
  if (!creditLimit || isNaN(creditLimit) || creditLimit <= 0) return { error: 'creditLimitRequired' };
  return { creditLimit };
}

export async function addWallet(_: WalletState, formData: FormData): Promise<WalletState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const name = formData.get('name') as string;
  const currency = (formData.get('currency') as string) || 'UZS';
  const color = (formData.get('color') as string) || null;
  const icon = parseIcon(formData);
  const kind = parseWalletKind(formData.get('kind'));

  if (!name) return { error: t('walletNameRequired') };

  const credit = parseCredit(formData, kind);
  if ('error' in credit) return { error: t(credit.error) };

  // Kredit hamyonda boshlang'ich qoldiq o'rniga hozirgi qarz kiritiladi — manfiy qoldiq bo'lib saqlanadi
  const balance = kind === 'CREDIT'
    ? -(parseFloat((formData.get('currentDebt') as string) || '0') || 0)
    : parseFloat((formData.get('balance') as string) || '0') || 0;

  await prisma.wallet.create({
    data: { userId: user.id, name, currency, balance, color, icon, kind, creditLimit: credit.creditLimit },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteWallet(_: WalletState, formData: FormData): Promise<WalletState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');
  const id = formData.get('id') as string;
  const wallet = await prisma.wallet.findFirst({ where: { id, userId: user.id } });
  if (!wallet) return { error: t('walletNotFound') };
  if (wallet.isDefault) return { error: t('defaultWalletDelete') };

  // O'tkazmalar boshqa hamyon balansiga ham ta'sir qilgan — ularni jimgina o'chirib bo'lmaydi
  const transferCount = await prisma.transaction.count({
    where: { type: 'TRANSFER', OR: [{ walletId: id }, { toWalletId: id }] },
  });
  if (transferCount > 0) {
    return {
      error: t('walletHasTransfers', { count: transferCount }),
    };
  }

  // Qarz yozuvlari qarz qoldig'ini hisoblaydi — ularni ham jimgina o'chirib bo'lmaydi
  const debtTxCount = await prisma.transaction.count({ where: { walletId: id, debtId: { not: null } } });
  if (debtTxCount > 0) {
    return {
      error: t('walletHasDebts', { count: debtTxCount }),
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
  const t = await getTranslations('errors');
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const color = (formData.get('color') as string) || null;
  const icon = parseIcon(formData);
  const makeDefault = formData.get('makeDefault') === 'on';
  const kind = parseWalletKind(formData.get('kind'));
  if (!name) return { error: t('walletNameRequired') };

  const credit = parseCredit(formData, kind);
  if ('error' in credit) return { error: t(credit.error) };

  const wallet = await prisma.wallet.findFirst({ where: { id, userId: user.id } });
  if (!wallet) return { error: t('walletNotFound') };

  await prisma.$transaction([
    // Asosiy hamyon bitta bo'ladi: avvalgisidan belgi olinadi
    ...(makeDefault && !wallet.isDefault
      ? [prisma.wallet.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } })]
      : []),
    prisma.wallet.update({
      where: { id },
      data: { name, color, icon, kind, creditLimit: credit.creditLimit, ...(makeDefault && { isDefault: true }) },
    }),
  ]);
  revalidatePath('/', 'layout');
  return { success: true };
}
