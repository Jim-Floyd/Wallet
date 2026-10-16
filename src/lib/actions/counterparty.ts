'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import { cleanName, type CounterpartyOption } from '@/lib/counterparty';

export type CounterpartyState = { error?: string; success?: boolean } | null;

async function getUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Foydalanuvchida shu ism bormi (katta-kichik harfsiz) — "Ali aka" va "ali aka" ikki odam bo'lib qolmasin
function findByName(userId: string, name: string, exceptId?: string) {
  return prisma.counterparty.findFirst({
    where: { userId, name: { equals: name, mode: 'insensitive' }, ...(exceptId && { id: { not: exceptId } }) },
  });
}

// Qarz oynasidagi "+" tugmasi: yangi odam qo'shib, darhol tanlash uchun qaytaradi
export async function createCounterparty(rawName: string, rawPhone: string | null): Promise<CounterpartyOption | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const name = cleanName(rawName ?? '');
  const phone = (rawPhone ?? '').trim() || null;
  if (!name) return { error: t('personRequired') };
  if (await findByName(userId, name)) return { error: t('counterpartyExists', { name }) };

  const cp = await prisma.counterparty.create({ data: { userId, name, phone } });
  revalidatePath('/', 'layout');
  return { id: cp.id, name: cp.name, phone: cp.phone };
}

// Tahrirlash: nom o'zgarsa, shu odamning barcha qarzlaridagi nom nusxasi ham yangilanadi
export async function updateCounterparty(_: CounterpartyState, formData: FormData): Promise<CounterpartyState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('id') as string;
  const name = cleanName((formData.get('name') as string) ?? '');
  const phone = ((formData.get('phone') as string) ?? '').trim() || null;
  const note = ((formData.get('note') as string) ?? '').trim() || null;
  if (!name) return { error: t('personRequired') };

  const cp = await prisma.counterparty.findFirst({ where: { id, userId } });
  if (!cp) return { error: t('recordNotFound') };
  if (await findByName(userId, name, id)) return { error: t('counterpartyExists', { name }) };

  await prisma.$transaction([
    prisma.counterparty.update({ where: { id }, data: { name, phone, note } }),
    prisma.debt.updateMany({ where: { userId, counterpartyId: id }, data: { person: name, phone } }),
  ]);
  revalidatePath('/', 'layout');
  return { success: true };
}

// Birlashtirish: manba odamning barcha qarzlari tanlangan odamga o'tadi, manba o'chiriladi
// (masalan, kirillcha "Али ака" → "Ali aka")
export async function mergeCounterparty(_: CounterpartyState, formData: FormData): Promise<CounterpartyState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const sourceId = formData.get('id') as string;
  const targetId = formData.get('targetId') as string;
  if (!targetId || targetId === sourceId) return { error: t('selectPerson') };

  const [source, target] = await Promise.all([
    prisma.counterparty.findFirst({ where: { id: sourceId, userId } }),
    prisma.counterparty.findFirst({ where: { id: targetId, userId } }),
  ]);
  if (!source || !target) return { error: t('recordNotFound') };

  await prisma.$transaction([
    prisma.debt.updateMany({
      where: { userId, counterpartyId: sourceId },
      data: { counterpartyId: targetId, person: target.name, phone: target.phone ?? undefined },
    }),
    // Manbada telefon bo'lib, nishonda bo'lmasa — saqlab qolinadi
    ...(!target.phone && source.phone ? [prisma.counterparty.update({ where: { id: targetId }, data: { phone: source.phone } })] : []),
    prisma.counterparty.delete({ where: { id: sourceId } }),
  ]);
  revalidatePath('/', 'layout');
  return { success: true };
}

// O'chirish — faqat qarzi yo'q odam (qarzlari bo'lsa, avval birlashtirish yoki qarzlarni o'chirish kerak)
export async function deleteCounterparty(_: CounterpartyState, formData: FormData): Promise<CounterpartyState> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const id = formData.get('id') as string;
  const debts = await prisma.debt.count({ where: { userId, counterpartyId: id } });
  if (debts > 0) return { error: t('counterpartyHasDebts', { count: debts }) };

  await prisma.counterparty.deleteMany({ where: { id, userId } });
  revalidatePath('/', 'layout');
  return { success: true };
}
