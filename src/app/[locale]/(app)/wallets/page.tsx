import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { processRecurring } from '@/lib/recurring-server';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddWalletDialog } from '@/components/dashboard/add-wallet-dialog';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { EditWalletDialog } from '@/components/wallets/edit-wallet-dialog';
import { WalletAvatar } from '@/components/wallets/wallet-avatar';
import { deleteWallet } from '@/lib/actions/wallet';

const CURRENCY_SYMBOLS: Record<string, string> = {
  UZS: "so'm",
  USD: '$',
  EUR: '€',
  RUB: '₽',
};

function formatBalance(amount: number | string | { toNumber: () => number }, currency: string) {
  const num = typeof amount === 'object' ? amount.toNumber() : Number(amount);
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  if (currency === 'UZS') {
    return `${num.toLocaleString('uz-UZ')} ${symbol}`;
  }
  return `${num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

export default async function WalletsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/uz/auth/login');
  await processRecurring(user.id);

  const wallets = await prisma.wallet.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hamyonlar</h1>
        <AddWalletDialog />
      </div>

      {wallets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">Hali hamyon qo&apos;shilmagan</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <Card key={wallet.id} className="relative overflow-hidden">
              {wallet.color && (
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: wallet.color }}
                />
              )}
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <WalletAvatar
                      icon={wallet.icon}
                      color={wallet.color}
                      currency={wallet.currency}
                      className="h-11 w-11"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{wallet.name}</p>
                        {wallet.isDefault && (
                          <Badge variant="secondary" className="text-xs shrink-0">Asosiy</Badge>
                        )}
                      </div>
                      <p className="text-2xl font-bold mt-1 tabular-nums">
                        {formatBalance(wallet.balance, wallet.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <EditWalletDialog
                      wallet={{
                        id: wallet.id,
                        name: wallet.name,
                        currency: wallet.currency,
                        color: wallet.color,
                        icon: wallet.icon,
                        isDefault: wallet.isDefault,
                      }}
                    />
                    {!wallet.isDefault && (
                      <ConfirmDeleteButton
                        id={wallet.id}
                        action={deleteWallet}
                        title="Hamyonni o'chirish"
                        description={`"${wallet.name}" hamyoni va undagi barcha kirim/chiqim yozuvlari o'chiriladi. Bu amalni qaytarib bo'lmaydi.`}
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
