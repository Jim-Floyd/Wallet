import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

const TYPE_LABELS: Record<string, string> = {
  INCOME: 'Daromad',
  EXPENSE: 'Xarajat',
  TRANSFER: "O'tkazma",
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const type = sp.get('type');
  const walletId = sp.get('walletId');
  const from = sp.get('from');
  const to = sp.get('to');

  const where = {
    userId: user.id,
    ...(type && { type: type as 'INCOME' | 'EXPENSE' | 'TRANSFER' }),
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
    },
  });

  const fmt = new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });

  const rows = transactions.map((tx) => ({
    'Sana': fmt.format(tx.date),
    'Tur': TYPE_LABELS[tx.type] ?? tx.type,
    'Hamyon': tx.wallet.name,
    'Miqdor': Number(tx.amount),
    'Valyuta': tx.currency,
    'Kategoriya': tx.category ?? '',
    'Izoh': tx.description?.replace(/\s*\|\s*Kurs:.*$/, '') ?? '',
    "Qabul hamyon": tx.toWallet?.name ?? '',
    "O'tkazma miqdori": tx.toAmount ? Number(tx.toAmount) : '',
    "O'tkazma valyutasi": tx.toCurrency ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  if (rows.length > 0) {
    ws['!cols'] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(k.length + 2, 14) }));
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tranzaksiyalar');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tranzaksiyalar-${date}.xlsx"`,
    },
  });
}
