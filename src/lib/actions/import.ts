'use server';

import * as XLSX from 'xlsx';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { balanceEffects, balanceUpdates } from '@/lib/balance';
import { dataRows, parseImportRows } from '@/lib/import';
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from '@/lib/import-limits';
import { loadImportContext } from '@/lib/import-context';

export type ImportState = { error?: string; rowErrors?: string[]; moreErrors?: number; imported?: number } | null;

const SHOWN_ERRORS = 20;

// Excel/CSV dan tranzaksiyalar: avval hamma qator tekshiriladi, bitta xato bo'lsa ham hech narsa qo'shilmaydi.
// Hammasi to'g'ri bo'lsa — yozuvlar, yangi kategoriyalar va balanslar bitta $transaction da.
export async function importTransactions(_: ImportState, formData: FormData): Promise<ImportState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  const t = await getTranslations('import');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: t('noFile') };
  if (file.size > IMPORT_MAX_BYTES) return { error: t('fileTooLarge') };

  let rows: unknown[][];
  try {
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
  } catch {
    return { error: t('unreadable') };
  }

  const data = dataRows(rows);
  if (data.length === 0) return { error: t('empty') };
  if (data.length > IMPORT_MAX_ROWS) return { error: t('tooManyRows', { max: IMPORT_MAX_ROWS }) };

  const { ctx } = await loadImportContext(user.id);
  const { txs, errors, newCategories } = parseImportRows(data, ctx);

  if (errors.length > 0) {
    return {
      error: t('hasErrors', { count: errors.length }),
      rowErrors: errors.slice(0, SHOWN_ERRORS).map(e => t('rowError', { row: e.row, message: t(e.key, e.values) })),
      moreErrors: Math.max(errors.length - SHOWN_ERRORS, 0),
    };
  }

  await prisma.$transaction([
    ...(newCategories.length > 0
      ? [prisma.category.createMany({ data: newCategories.map(name => ({ userId: user.id, name })), skipDuplicates: true })]
      : []),
    prisma.transaction.createMany({ data: txs.map(tx => ({ ...tx, userId: user.id })) }),
    ...balanceUpdates(txs.flatMap(tx => balanceEffects(tx))),
  ]);

  revalidatePath('/', 'layout');
  return { imported: txs.length };
}
