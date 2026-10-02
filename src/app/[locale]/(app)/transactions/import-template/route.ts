import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { loadImportContext } from '@/lib/import-context';
import { EXPENSE_DEFAULTS, INCOME_DEFAULTS, categoryName } from '@/lib/category-icons';
import { dayKey } from '@/lib/days';
import { IMPORT_MAX_ROWS } from '@/lib/import-limits';

const COLUMNS = ['date', 'type', 'wallet', 'amount', 'category', 'note', 'toWallet', 'rate'] as const;
const WIDTHS = [14, 14, 22, 16, 22, 32, 24, 12];

// Import shabloni (ExcelJS — xlsx kutubxonasi ochiladigan ro'yxatlarni yoza olmaydi):
// 1-varaq — to'ldiriladigan jadval: Tur/Hamyon/Kategoriya/Qabul qiluvchi hamyon ro'yxatdan tanlanadi,
// 2-varaq — yo'riqnoma va namuna, 3-varaq (yashirin) — ro'yxatlar manbasi
export async function GET(_: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const t = await getTranslations({ locale, namespace: 'import' });
  const tCat = await getTranslations({ locale, namespace: 'defaultCategories' });
  const { wallets, categories } = await loadImportContext(user.id);

  const headers = COLUMNS.map(c => t(`columns.${c}`));
  const types = (['INCOME', 'EXPENSE', 'TRANSFER'] as const).map(type => t(`types.${type}`));
  const walletNames = wallets.map(w => w.name);
  const customCategories = categories.map(c => c.name).filter(n => !INCOME_DEFAULTS.includes(n) && !EXPENSE_DEFAULTS.includes(n));
  const categoryNames = Array.from(new Set([...INCOME_DEFAULTS, ...EXPENSE_DEFAULTS].map(n => categoryName(n, tCat)).concat(customCategories)));

  const wb = new ExcelJS.Workbook();

  // --- To'ldiriladigan jadval ---
  const data = wb.addWorksheet(t('template.sheetData'), { views: [{ state: 'frozen', ySplit: 1 }] });
  data.columns = headers.map((header, i) => ({ header, width: WIDTHS[i] }));
  data.getRow(1).font = { bold: true };

  // --- Ro'yxatlar (yashirin): A — turlar, B — hamyonlar, C — kategoriyalar ---
  const lists = wb.addWorksheet(t('template.sheetLists'), { state: 'hidden' });
  lists.getColumn(1).values = [t('columns.type'), ...types];
  lists.getColumn(2).values = [t('columns.wallet'), ...walletNames];
  lists.getColumn(3).values = [t('columns.category'), ...categoryNames];
  // Varaq nomidagi apostrof formulada ikkilanadi: 'Ro''yxatlar'!$A$2:$A$4
  const listRef = (col: string, count: number) =>
    `'${lists.name.replace(/'/g, "''")}'!$${col}$2:$${col}$${Math.max(count + 1, 2)}`;

  const last = IMPORT_MAX_ROWS + 1;
  const pick = (formula: string, strict: boolean, error: string): ExcelJS.DataValidation => ({
    type: 'list',
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: true,
    errorStyle: strict ? 'stop' : 'warning',
    error,
  });
  const positive = (error: string): ExcelJS.DataValidation => ({
    type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0], showErrorMessage: true, error,
  });
  // dataValidations.add ExcelJS turlarida yo'q, lekin mavjud — diapazon uchun bitta yozuv (1000 ta alohida emas)
  const validations = (data as unknown as { dataValidations: { add: (range: string, v: ExcelJS.DataValidation) => void } }).dataValidations;
  validations.add(`A2:A${last}`, { type: 'date', operator: 'greaterThan', allowBlank: true, formulae: [new Date(Date.UTC(2000, 0, 1))], showErrorMessage: true, error: t('template.errDate') });
  validations.add(`B2:B${last}`, pick(listRef('A', types.length), true, t('template.errPick')));
  validations.add(`C2:C${last}`, pick(listRef('B', walletNames.length), true, t('template.errPick')));
  validations.add(`D2:D${last}`, positive(t('template.errPositive')));
  validations.add(`E2:E${last}`, pick(listRef('C', categoryNames.length), false, t('template.warnNewCategory')));
  validations.add(`G2:G${last}`, pick(listRef('B', walletNames.length), true, t('template.errPick')));
  validations.add(`H2:H${last}`, positive(t('template.errPositive')));
  data.getColumn(1).numFmt = 'dd.mm.yyyy';

  // --- Yo'riqnoma ---
  const [y, m, d] = dayKey(new Date()).split('-');
  const today = `${d}.${m}.${y}`; // namunada doim kun.oy.yil — importda aynan shu tartib o'qiladi
  const [w1, w2] = [wallets[0], wallets.find(w => w.id !== wallets[0]?.id)];
  const examples: (string | number)[][] = w1
    ? [
        [today, t('types.EXPENSE'), w1.name, 45000, categoryName('Oziq-ovqat', tCat), t('template.exampleNote')],
        [today, t('types.INCOME'), w1.name, 5000000, categoryName('Maosh', tCat), ''],
        ...(w2 ? [[today, t('types.TRANSFER'), w1.name, 100, '', '', w2.name, w1.currency === w2.currency ? '' : 12650]] : []),
      ]
    : [];

  const help = wb.addWorksheet(t('template.sheetHelp'));
  help.columns = [{ width: 26 }, { width: 90 }];
  const title = help.addRow([t('template.title')]);
  title.font = { bold: true, size: 13 };
  help.addRow([t('template.rules')]);
  help.addRow([t('template.dropdowns')]);
  help.addRow([]);
  help.addRow([t('template.column'), t('template.whatToWrite')]).font = { bold: true };
  for (const c of COLUMNS) help.addRow([t(`columns.${c}`), t(`template.help.${c}`)]);
  help.addRow([]);
  help.addRow([t('template.wallets')]).font = { bold: true };
  for (const w of wallets) help.addRow([w.name, w.currency]);
  help.addRow([]);
  help.addRow([t('template.categories')]).font = { bold: true };
  help.addRow([t('types.INCOME'), INCOME_DEFAULTS.map(n => categoryName(n, tCat)).join(', ')]);
  help.addRow([t('types.EXPENSE'), EXPENSE_DEFAULTS.map(n => categoryName(n, tCat)).join(', ')]);
  if (customCategories.length > 0) help.addRow([t('template.yourCategories'), customCategories.join(', ')]);
  if (examples.length > 0) {
    help.addRow([]);
    help.addRow([t('template.example')]).font = { bold: true };
    help.addRow(headers).font = { bold: true };
    for (const row of examples) help.addRow(row);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="hamyon-import-shablon.xlsx"',
    },
  });
}
