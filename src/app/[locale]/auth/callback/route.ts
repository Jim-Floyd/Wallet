import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? `/${locale}/dashboard`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const existing = await prisma.user.findUnique({ where: { id: user.id } });
        if (!existing) {
          await prisma.user.create({
            data: {
              id: user.id,
              email: user.email || null,
              phone: user.phone || null,
              name: user.user_metadata?.full_name ?? null,
              locale,
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
      }

      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
}
