'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';

export type SettingsState = { error?: string; success?: boolean } | null;

export async function updateProfile(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const name = (formData.get('name') as string).trim();
  const currency = formData.get('currency') as string;

  if (!name) return { error: t('nameRequired') };

  await Promise.all([
    prisma.user.update({ where: { id: user.id }, data: { name, currency } }),
    supabase.auth.updateUser({ data: { full_name: name } }),
  ]);

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updatePassword(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const t = await getTranslations('errors');

  const password = formData.get('password') as string;
  const confirm = formData.get('confirm') as string;

  if (!password || password.length < 6) return { error: t('passwordTooShort') };
  if (password !== confirm) return { error: t('passwordMismatch') };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { success: true };
}
