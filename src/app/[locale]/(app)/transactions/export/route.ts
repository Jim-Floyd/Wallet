import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { processRecurring } from '@/lib/recurring-server';
import * as XLSX from 'xlsx';
import { debtTxLabel, txTypeWhere } from '@/lib/debt';
import { getTranslations } from 'next-intl/server';
import { formatDay } from '@/lib/days';
import { categoryName } from '@/lib/category-icons';

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'export' });
  const tDebt = await getTranslations({ locale, namespace: 'debts' });
  const tCat = await getTranslations({ locale, namespace: 'defaultCategories' });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await processRecurring(user.id);

  const sp = request.nextUrl.searchParams;
  const type = sp.get('type');
  const walletId = sp.get('walletId');
  const from = sp.get('from');
  const to = sp.get('to');

  const where = {
    userId: user.id,
    ...txTypeWhere(type),
    ...(walletId && { walletId }),
    ...((from || to) && {
      date: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to + 'T23:59:59') }),
      },
    }),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      wallet: { select: { name: true } },
      toWallet: { select: { name: true } },
      debt: { select: { type: true, person: true } },
    },
  });

  const rows = transactions.map((tx) => {
    const parts = (tx.description ?? '').split(' | ');
    // eski tranzaksiyalar uchun description dan fallback
    const legacyRate = parts.find((p) => p.startsWith('Kurs:'));
    const kurs = tx.rate
      ? Number(tx.rate)
      : legacyRate
        ? Number(legacyRate.match(/=\s*([\d.]+)/)?.[1] ?? '') || ''
        : '';
    const izoh = parts.filter((p) => !p.startsWith('Kurs:')).join(' | ');

    return {
      [t('date')]: formatDay(tx.date, locale),
      [t('type')]: t(`types.${tx.type}`),
      [t('wallet')]: tx.wallet.name,
      [t('amount')]: Number(tx.amount),
      [t('currency')]: tx.currency,
      [t('category')]: tx.debt ? debtTxLabel(tx.type, tx.debt, tDebt) : tx.category ? categoryName(tx.category, tCat) : '',
      [t('note')]: izoh,
      [t('rate')]: kurs,
      [t('toWallet')]: tx.toWallet?.name ?? '',
      [t('toAmount')]: tx.toAmount ? Number(tx.toAmount) : '',
      [t('toCurrency')]: tx.toCurrency ?? '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  if (rows.length > 0) {
    ws['!cols'] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(k.length + 2, 14) }));
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t('sheetName'));

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tranzaksiyalar-${date}.xlsx"`,
    },
  });
}
