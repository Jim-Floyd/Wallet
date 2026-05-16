import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddWalletDialog } from '@/components/dashboard/add-wallet-dialog';
import { deleteWallet } from '@/lib/actions/wallet';
import { Trash2 } from 'lucide-react';

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
                  {!wallet.isDefault && (
                    <form action={async (fd) => { 'use server'; await deleteWallet(null, fd); }} className="shrink-0">
                      <input type="hidden" name="id" value={wallet.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
