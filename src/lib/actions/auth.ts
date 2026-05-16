'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export type AuthState = { error?: string; success?: boolean; phone?: string } | null;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('998')) return `+${digits}`;
  return `+998${digits.replace(/^0/, '')}`;
}

async function createUserWithWallet(
  userId: string,
  data: { email?: string | null; phone?: string | null; name?: string | null; locale: string }
) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing) return;

  await prisma.user.create({
    data: {
      id: userId,
      email: data.email || null,
      phone: data.phone || null,
      name: data.name || null,
      locale: data.locale,
      wallets: {
        create: {
          name: 'Naqd pul',
          currency: 'UZS',
          isDefault: true,
          color: '#22c55e',
        },
      },
    },
  });
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const locale = (formData.get('locale') as string) || 'uz';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === 'email_not_confirmed') return { error: 'email_not_confirmed' };
    return { error: error.message };
  }

  if (data.user) {
    await createUserWithWallet(data.user.id, {
      email: data.user.email,
      name: data.user.user_metadata?.full_name ?? null,
      locale,
    });
  }

  revalidatePath('/', 'layout');
  redirect(`/${locale}/dashboard`);
}

export async function register(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;
  const locale = (formData.get('locale') as string) || 'uz';

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function forgotPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const locale = (formData.get('locale') as string) || 'uz';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/auth/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function resetPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();

  const password = formData.get('password') as string;
  const locale = (formData.get('locale') as string) || 'uz';

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect(`/${locale}/dashboard`);
}

export async function sendPhoneOtp(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const phone = normalizePhone(formData.get('phone') as string);

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { channel: 'sms' },
  });

  if (error) return { error: error.message };
  return { success: true, phone };
}

export async function verifyPhoneOtp(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const phone = formData.get('phone') as string;
  const token = formData.get('token') as string;
  const fullName = formData.get('fullName') as string;
  const locale = (formData.get('locale') as string) || 'uz';

  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });

  if (error) return { error: error.message };

  if (data.user) {
    await supabase.auth.updateUser({ data: { full_name: fullName } });
    await createUserWithWallet(data.user.id, {
      email: data.user.email || null,
      phone,
      name: fullName || null,
      locale,
    });
  }

  revalidatePath('/', 'layout');
  redirect(`/${locale}/dashboard`);
}

export async function logout(locale: string = 'uz') {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect(`/${locale}/auth/login`);
}
