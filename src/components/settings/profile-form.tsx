'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateProfile, type SettingsState } from '@/lib/actions/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

const CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB'];

interface Props {
  name: string;
  email: string;
  currency: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Saqlash
    </Button>
  );
}

export function ProfileForm({ name, email, currency }: Props) {
  const [state, action] = useFormState<SettingsState, FormData>(updateProfile, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>}
      {state?.success && <Alert className="text-sm py-2 border-green-500 text-green-700">Saqlandi</Alert>}

      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={email} disabled className="bg-muted" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Ism</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="currency">Asosiy valyuta</Label>
        <select
          id="currency"
          name="currency"
          defaultValue={currency}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <SubmitButton />
    </form>
  );
}
