'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { addWallet, type WalletState } from '@/lib/actions/wallet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';

const CURRENCIES = [
  { value: 'UZS', label: "So'm",   flag: '🇺🇿' },
  { value: 'USD', label: 'Dollar', flag: '🇺🇸' },
  { value: 'EUR', label: 'Evro',   flag: '🇪🇺' },
  { value: 'RUB', label: 'Rubl',   flag: '🇷🇺' },
];

const COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6b7280'];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Saqlash
    </Button>
  );
}

export function AddWalletDialog() {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState('UZS');
  const [color, setColor] = useState(COLORS[0]);
  const [state, action] = useFormState<WalletState, FormData>(addWallet, null);

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      setCurrency('UZS');
      setColor(COLORS[0]);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" />}>
        <Plus className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yangi hamyon</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="color" value={color} />

          {state?.error && (
            <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="wallet-name">Nomi</Label>
            <Input id="wallet-name" name="name" placeholder="Masalan: Asosiy hamyon" required />
          </div>

          <div className="space-y-2">
            <Label>Valyuta</Label>
            <div className="grid grid-cols-4 gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCurrency(c.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border py-3 text-sm transition-colors ${
                    currency === c.value
                      ? 'border-primary bg-primary/5 font-semibold text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="text-xl">{c.flag}</span>
                  <span className="font-mono text-xs font-bold">{c.value}</span>
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wallet-balance">Boshlang&apos;ich balans ({currency})</Label>
            <Input
              id="wallet-balance"
              name="balance"
              type="number"
              min="0"
              step={currency === 'UZS' ? '1000' : '0.01'}
              placeholder="0"
              defaultValue="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Rang</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-offset-1 ring-foreground' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
