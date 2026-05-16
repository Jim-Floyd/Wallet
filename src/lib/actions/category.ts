'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function createCategory(name: string): Promise<{ id: string; name: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const trimmed = name.trim();
  if (!trimmed) return { error: 'Nom kiritilishi shart' };

  const category = await prisma.category.upsert({
    where: { userId_name: { userId: user.id, name: trimmed } },
    update: {},
    create: { userId: user.id, name: trimmed },
  });

  revalidatePath('/', 'layout');
  return { id: category.id, name: category.name };
}
