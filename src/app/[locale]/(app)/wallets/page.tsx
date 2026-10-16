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
import { CreditUsage } from '@/components/wallets/credit-usage';
import { deleteWallet } from '@/lib/actions/wallet';
import { creditInfo, walletOption } from '@/lib/credit';
import { investmentSummaries } from '@/lib/investment';
import { TransactionDialog } from '@/components/transactions/transaction-dialog';
import { InvestmentIncomeDialog, RevalueDialog, SellDialog } from '@/components/investments/investment-dialogs';
import { walletEffectTotals } from '@/lib/balance';
import { StickyHeader } from '@/components/sticky-header';
import { getTranslations } from 'next-intl/server';
import { formatMoney, formatMoneySigned, intlLocale } from '@/lib/intl';
import { formatDay } from '@/lib/days';

// UZS belgisi tarjimada (wallets.uzsSymbol)
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  RUB: '₽',
};

function formatBalance(amount: { toString(): string }, currency: string, locale: string, uzsSymbol: string) {
  const num = Number(amount);
  const symbol = currency === 'UZS' ? uzsSymbol : CURRENCY_SYMBOLS[currency] ?? currency;
  const digits = currency === 'UZS' ? { maximumFractionDigits: 2 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return `${num.toLocaleString(intlLocale(locale), digits)} ${symbol}`;
}

export default async function WalletsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('wallets');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  await processRecurring(user.id);

  const [wallets, effectTotals, categories] = await Promise.all([
    prisma.wallet.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),
    walletEffectTotals(user.id),
    prisma.category.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
  ]);
  // Investitsiyalar: kiritilgan, joriy qiymat, natija
  const investments = await investmentSummaries(user.id, wallets.filter(w => w.kind === 'INVESTMENT'));
  const walletList = wallets.map(walletOption);
  const categoryList = categories.map(c => ({ id: c.id, name: c.name, icon: c.icon }));
  // Boshlang'ich qoldiq = hozirgi balans − barcha tranzaksiyalar ta'siri (tahrirlash oynasi uchun)
  const openingOf = (w: (typeof wallets)[number]) => Number(w.balance) - (effectTotals.get(w.id) ?? 0);

  return (
    <div className="space-y-6">
      <StickyHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <AddWalletDialog />
        </div>
      </StickyHeader>

      {wallets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">{t('empty')}</p>
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
                          <Badge variant="secondary" className="text-xs shrink-0">{t('default')}</Badge>
                        )}
                      </div>
                      <p className={`text-2xl font-bold mt-1 tabular-nums ${Number(wallet.balance) < 0 ? 'text-red-600' : ''}`}>
                        {formatBalance(investments.get(wallet.id)?.market ?? wallet.balance, wallet.currency, locale, t('uzsSymbol'))}
                      </p>
                      {investments.get(wallet.id) && (() => {
                        const inv = investments.get(wallet.id)!;
                        return (
                          <div className="mt-0.5 space-y-0.5 text-xs">
                            <p className="text-muted-foreground">{t('kinds.INVESTMENT')} · {t('invested')}: {formatMoney(inv.invested, wallet.currency, locale)}</p>
                            <p className={inv.result > 0 ? 'text-green-700 dark:text-green-500' : inv.result < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                              {t('investmentResult')}: {formatMoneySigned(inv.result, wallet.currency, locale)}
                              {inv.resultPct != null && ` (${inv.resultPct >= 0 ? '+' : ''}${inv.resultPct.toFixed(1)}%)`}
                            </p>
                            <p className="text-muted-foreground">
                              {t('earnedPart')}: {formatMoneySigned(inv.earned, wallet.currency, locale)} · {t('revaluationPart')}: {formatMoneySigned(inv.gain, wallet.currency, locale)}
                            </p>
                            {inv.valuedAt && <p className="text-muted-foreground">{t('valuedAt', { date: formatDay(inv.valuedAt, locale) })}</p>}
                          </div>
                        );
                      })()}
                      {wallet.kind === 'CREDIT' && (
                        <p className="text-xs text-muted-foreground">{t('kinds.CREDIT')}</p>
                      )}
                      {creditInfo(wallet) && <CreditUsage info={creditInfo(wallet)!} currency={wallet.currency} />}
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
                        kind: wallet.kind,
                        creditLimit: wallet.creditLimit == null ? null : Number(wallet.creditLimit),
                        balance: Number(wallet.balance),
                        opening: openingOf(wallet),
                      }}
                    />
                    {!wallet.isDefault && (
                      <ConfirmDeleteButton
                        id={wallet.id}
                        action={deleteWallet}
                        title={t('deleteTitle')}
                        description={t('deleteDescription', { name: wallet.name })}
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      />
                    )}
                  </div>
                </div>
                {investments.get(wallet.id) && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                    <TransactionDialog
                      wallets={walletList}
                      savedCategories={categoryList}
                      preset={{ type: 'TRANSFER', toWalletId: wallet.id }}
                      triggerLabel={t('contribute')}
                    />
                    <InvestmentIncomeDialog
                      investment={{ id: wallet.id, name: wallet.name, currency: wallet.currency, book: Number(wallet.balance), market: investments.get(wallet.id)!.market }}
                      wallets={walletList}
                    />
                    <RevalueDialog
                      investment={{ id: wallet.id, name: wallet.name, currency: wallet.currency, book: Number(wallet.balance), market: investments.get(wallet.id)!.market }}
                    />
                    <SellDialog
                      investment={{ id: wallet.id, name: wallet.name, currency: wallet.currency, book: Number(wallet.balance), market: investments.get(wallet.id)!.market }}
                      wallets={walletList}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
