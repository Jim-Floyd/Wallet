'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import { balanceEffects, balanceUpdates } from '@/lib/balance';
import { parseFormDate } from '@/lib/form-date';
import { INVESTMENT_LOSS, INVESTMENT_PROFIT } from '@/lib/investment';

export type InvestmentState = { error?: string; success?: boolean } | null;

const round2 = (n: number) => Math.round(n * 100) / 100;

async function getUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function findInvestment(userId: string, id: string) {
  return prisma.wallet.findFirst({ where: { id, userId, kind: 'INVESTMENT' } });
}

// Investitsiyadan daromad: investitsiyaning o'zida qoladi (qayta investitsiya) yoki boshqa hamyonga olinadi.
// Ikkala holatda ham oylik daromadga kiradi (realizatsiya qilingan foyda)
export async function addInvestmentIncome(_: InvestmentState, formData: FormData): Promise<InvestmentState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const investmentId = formData.get('investmentId') as string;
  const targetId = (formData.get('walletId') as string) || investmentId;
  const amount = parseFloat(formData.get('amount') as string);
  const description = ((formData.get('description') as string) ?? '').trim() || null;
  if (!amount || isNaN(amount) || amount <= 0) return { error: t('amountPositive') };
  const date = parseFormDate(formData);
  if (date && !(date instanceof Date)) return { error: t(date.error) };

  const investment = await findInvestment(userId, investmentId);
  if (!investment) return { error: t('walletNotFound') };
  const target = targetId === investmentId ? investment : await prisma.wallet.findFirst({ where: { id: targetId, userId } });
  if (!target) return { error: t('walletNotFound') };
  if (target.currency !== investment.currency) return { error: t('walletCurrencyMismatch', { currency: investment.currency }) };

  const tx = {
    type: 'INCOME' as const, walletId: target.id, toWalletId: target.id === investment.id ? null : investment.id,
    amount, toAmount: null,
  };
  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId, ...tx, currency: investment.currency, category: INVESTMENT_PROFIT, description,
        ...(date && { date }),
      },
    }),
    ...balanceUpdates(balanceEffects(tx)),
  ]);

  revalidatePath('/', 'layout');
  return { success: true };
}

// Joriy (bozor) qiymatni yangilash: faqat qayta baholash farqi saqlanadi (joriy − balans), tranzaksiya yaratilmaydi
export async function revalueInvestment(_: InvestmentState, formData: FormData): Promise<InvestmentState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('investmentId') as string;
  const value = parseFloat(formData.get('value') as string);
  if (isNaN(value) || value < 0) return { error: t('invalidAmount') };

  const investment = await findInvestment(userId, id);
  if (!investment) return { error: t('walletNotFound') };

  await prisma.wallet.update({
    where: { id },
    data: { valuationGain: round2(value - Number(investment.balance)), valuedAt: new Date() },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

// Sotish / chiqarish: olingan summa boshqa hamyonga tushadi. Sotilgan ulush (share, %) bo'yicha hisobdagi qiymat
// (tannarx + ichida qolgan daromad) o'tkazma bo'lib qaytadi; ortig'i — daromad, kami — zarar.
// Qayta baholash farqi ham shu ulushda kamayadi (to'liq sotilsa — 0)
export async function sellInvestment(_: InvestmentState, formData: FormData): Promise<InvestmentState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('investmentId') as string;
  const targetId = formData.get('walletId') as string;
  const received = parseFloat(formData.get('amount') as string);
  const sharePct = parseFloat(formData.get('share') as string);
  const description = ((formData.get('description') as string) ?? '').trim() || null;
  if (isNaN(received) || received < 0) return { error: t('invalidAmount') };
  if (!(sharePct > 0 && sharePct <= 100)) return { error: t('invalidShare') };
  const date = parseFormDate(formData);
  if (date && !(date instanceof Date)) return { error: t(date.error) };

  const investment = await findInvestment(userId, id);
  if (!investment) return { error: t('walletNotFound') };
  const target = await prisma.wallet.findFirst({ where: { id: targetId, userId } });
  if (!target || target.id === investment.id) return { error: t('selectWallet') };
  if (target.currency !== investment.currency) return { error: t('walletCurrencyMismatch', { currency: investment.currency }) };

  const share = sharePct / 100;
  const book = Number(investment.balance);
  const principal = round2(Math.max(book, 0) * share);
  const currency = investment.currency;
  const base = { userId, currency, description, ...(date && { date }) };

  // Pul oqimi: investitsiya −principal, hamyon +received (farq daromad yoki zarar bo'lib yoziladi)
  const transferAmount = round2(Math.min(received, principal));
  const profit = round2(received - principal);
  const ops = [];
  const effects = [];

  if (transferAmount > 0) {
    const transfer = { type: 'TRANSFER' as const, walletId: investment.id, toWalletId: target.id, amount: transferAmount, toAmount: transferAmount };
    ops.push(prisma.transaction.create({ data: { ...base, ...transfer, toCurrency: currency } }));
    effects.push(...balanceEffects(transfer));
  }
  if (profit > 0) {
    const income = { type: 'INCOME' as const, walletId: target.id, toWalletId: investment.id, amount: profit, toAmount: null };
    ops.push(prisma.transaction.create({ data: { ...base, ...income, category: INVESTMENT_PROFIT } }));
    effects.push(...balanceEffects(income));
  } else if (profit < 0) {
    const loss = { type: 'EXPENSE' as const, walletId: investment.id, toWalletId: null, amount: -profit, toAmount: null };
    ops.push(prisma.transaction.create({ data: { ...base, ...loss, category: INVESTMENT_LOSS } }));
    effects.push(...balanceEffects(loss));
  }
  if (ops.length === 0) return { error: t('amountPositive') };

  const gain = Number(investment.valuationGain);
  await prisma.$transaction([
    ...ops,
    ...balanceUpdates(effects),
    prisma.wallet.update({ where: { id: investment.id }, data: { valuationGain: share >= 1 ? 0 : round2(gain * (1 - share)) } }),
  ]);

  revalidatePath('/', 'layout');
  return { success: true };
}
