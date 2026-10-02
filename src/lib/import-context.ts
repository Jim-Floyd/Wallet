import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { routing } from '@/i18n/routing';
import { DEFAULT_CATEGORIES } from '@/lib/category-icons';
import { dayKey } from '@/lib/days';
import { normKey, type ImportContext, type ImportTxType } from '@/lib/import';

const TYPES: ImportTxType[] = ['INCOME', 'EXPENSE', 'TRANSFER'];

// Import uchun kontekst: tur va standart kategoriya nomlari barcha tillarda tan olinadi
// (fayl qaysi tilda to'ldirilgani muhim emas)
export async function loadImportContext(userId: string) {
  const [wallets, categories] = await Promise.all([
    prisma.wallet.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, currency: true },
    }),
    prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { name: true } }),
  ]);

  const typeWords = new Map<string, ImportTxType>(TYPES.map(type => [normKey(type), type]));
  const categoryAliases = new Map<string, string>();
  for (const locale of routing.locales) {
    const [t, tExport, tCat] = await Promise.all([
      getTranslations({ locale, namespace: 'import' }),
      getTranslations({ locale, namespace: 'export' }),
      getTranslations({ locale, namespace: 'defaultCategories' }),
    ]);
    for (const type of TYPES) {
      typeWords.set(normKey(t(`types.${type}`)), type);
      typeWords.set(normKey(tExport(`types.${type}`)), type);
    }
    for (const def of DEFAULT_CATEGORIES) categoryAliases.set(normKey(tCat(def.id)), def.name);
  }
  for (const def of DEFAULT_CATEGORIES) categoryAliases.set(normKey(def.name), def.name);
  // Foydalanuvchi kategoriyasi oxirida — nomi tarjimaga to'g'ri kelsa ham o'zi saqlanadi
  for (const c of categories) categoryAliases.set(normKey(c.name), c.name);

  const ctx: ImportContext = { wallets, typeWords, categoryAliases, today: dayKey(new Date()) };
  return { ctx, wallets, categories };
}
