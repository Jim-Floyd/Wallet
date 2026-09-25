import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, HandCoins } from 'lucide-react';
import { categoryIconKey, getCategoryIcon, iconBg } from '@/lib/category-icons';
import { cn } from '@/lib/utils';

// Tranzaksiya belgisi: qarz → qo'l; kategoriyasi bo'lsa → kategoriya belgisi o'z rangida;
// aks holda yo'nalish strelkasi tur rangida (kirim yashil, chiqim qizil, o'tkazma ko'k, qarz sariq).
export function TxIcon({
  type,
  category,
  isDebt,
  categoryIcons,
  className,
}: {
  type: string;
  category: string | null;
  isDebt: boolean;
  categoryIcons: Record<string, string | null>; // kategoriya nomi → tanlangan belgi
  className?: string;
}) {
  const isIncome = type === 'INCOME' || type === 'DEBT_IN';
  const isTransfer = type === 'TRANSFER';

  const bg = isDebt ? 'bg-amber-100' : isIncome ? 'bg-green-100' : isTransfer ? 'bg-blue-100' : 'bg-red-100';
  const fg = isDebt ? 'text-amber-600' : isIncome ? 'text-green-600' : isTransfer ? 'text-blue-600' : 'text-red-600';

  const categoryIcon = !isDebt && category
    ? getCategoryIcon(categoryIconKey(category, categoryIcons[category]))
    : null;

  // Kategoriya belgisi o'z rangida
  if (categoryIcon) {
    const { Icon, color } = categoryIcon;
    return (
      <div
        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', className)}
        style={{ backgroundColor: iconBg(color) }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
    );
  }

  const Icon = isDebt ? HandCoins : isIncome ? ArrowUpRight : isTransfer ? ArrowLeftRight : ArrowDownRight;
  return (
    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', bg, className)}>
      <Icon className={cn('h-4 w-4', fg)} />
    </div>
  );
}
