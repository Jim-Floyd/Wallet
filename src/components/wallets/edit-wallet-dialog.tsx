'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { updateWallet, type WalletState } from '@/lib/actions/wallet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { WalletStyleFields } from '@/components/wallets/wallet-style-fields';
import { WALLET_COLORS } from '@/lib/wallet-icons';
import { WalletKindFields } from '@/components/wallets/wallet-kind-fields';
import type { WalletKindValue } from '@/lib/credit';
import { Loader2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

function SubmitButton() {
  const t = useTranslations('common');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {t('save')}
    </Button>
  );
}

export function EditWalletDialog({
  wallet,
  className,
}: {
  className?: string;
  wallet: {
    id: string; name: string; currency: string; color: string | null; icon: string | null; isDefault: boolean;
    kind: WalletKindValue; creditLimit: number | null;
  };
}) {
  const t = useTranslations('wallets');
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(wallet.color ?? WALLET_COLORS[0]);
  const [icon, setIcon] = useState<string | null>(wallet.icon);
  const [kind, setKind] = useState<WalletKindValue>(wallet.kind);
  const [state, action] = useFormState<WalletState, FormData>(updateWallet, null);

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  function handleOpenChange(next: boolean) {
    if (next) {
      setColor(wallet.color ?? WALLET_COLORS[0]);
      setIcon(wallet.icon);
      setKind(wallet.kind);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className={className ?? 'h-8 w-8 shrink-0 text-muted-foreground'} />}
      >
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={wallet.id} />

          {state?.error && (
            <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-wallet-name">{t('name')}</Label>
            <Input id="edit-wallet-name" name="name" defaultValue={wallet.name} required />
          </div>

          <WalletKindFields kind={kind} currency={wallet.currency} defaultLimit={wallet.creditLimit} onKindChange={setKind} />

          <WalletStyleFields
            color={color}
            icon={icon}
            currency={wallet.currency}
            onColorChange={setColor}
            onIconChange={setIcon}
          />

          {!wallet.isDefault && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
              <input type="checkbox" name="makeDefault" className="mt-0.5 h-4 w-4 accent-primary" />
              <span>
                <span className="font-medium">{t('makeDefault')}</span>
                <span className="block text-xs text-muted-foreground">
                  {t('makeDefaultHint')}
                </span>
              </span>
            </label>
          )}

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
