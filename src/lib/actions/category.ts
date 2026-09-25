'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { CATEGORY_ICON_KEYS } from '@/lib/category-icons';

type CategoryResult = { id: string; name: string; icon: string | null };

// Mavjud nom bilan qayta qo'shilsa — belgisi yangilanadi
export async function createCategory(name: string, icon?: string | null): Promise<CategoryResult | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const trimmed = name.trim();
  if (!trimmed) return { error: 'Nom kiritilishi shart' };
  const validIcon = icon && CATEGORY_ICON_KEYS.includes(icon) ? icon : null;

  const category = await prisma.category.upsert({
    where: { userId_name: { userId: user.id, name: trimmed } },
    update: validIcon ? { icon: validIcon } : {},
    create: { userId: user.id, name: trimmed, icon: validIcon },
  });

  revalidatePath('/', 'layout');
  return { id: category.id, name: category.name, icon: category.icon };
}
