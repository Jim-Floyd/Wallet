import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { TransactionDialog, type EditableTransaction } from '@/components/transactions/transaction-dialog';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { deleteTransaction } from '@/lib/actions/transaction';

type Tx = {
  id: string;
  type: string;
  walletId: string;
  toWalletId: string | null;
  amount: { toString(): string };
  rate: { toString(): string } | null;
  category: string | null;
  description: string | null;
  date: Date;
  debtId: string | null;
};

// Tranzaksiya qatoridagi tahrirlash/o'chirish tugmalari.
// Qarz yozuvlari Qarzlar sahifasida boshqariladi — ular uchun havola.
export function TransactionActions({
  tx,
  locale,
  wallets,
  categories,
}: {
  tx: Tx;
  locale: string;
  wallets: { id: string; name: string; currency: string }[];
  categories: { id: string; name: string; icon: string | null }[];
}) {
  if (tx.debtId) {
    return (
      <Link
        href={`/${locale}/debts`}
        title="Qarzlar sahifasida boshqarish"
        className="flex h-7 w-14 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    );
  }

  return (
    <div className="flex shrink-0 items-center">
      <TransactionDialog
        wallets={wallets}
        savedCategories={categories}
        transaction={{
          id: tx.id,
          type: tx.type as EditableTransaction['type'],
          walletId: tx.walletId,
          toWalletId: tx.toWalletId,
          amount: Number(tx.amount),
          rate: tx.rate ? Number(tx.rate) : null,
          category: tx.category,
          description: tx.description,
          date: tx.date.toISOString(),
        }}
      />
      <ConfirmDeleteButton
        id={tx.id}
        action={deleteTransaction}
        title="Tranzaksiyani o'chirish"
        description="Tranzaksiya o'chiriladi va hamyon balansi avvalgi holatiga qaytariladi."
      />
    </div>
  );
}
