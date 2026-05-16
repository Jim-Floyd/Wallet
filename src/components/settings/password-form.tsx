'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useRef } from 'react';
import { updatePassword, type SettingsState } from '@/lib/actions/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Parolni yangilash
    </Button>
  );
}

export function PasswordForm() {
  const [state, action] = useFormState<SettingsState, FormData>(updatePassword, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state?.error && <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>}
      {state?.success && <Alert className="text-sm py-2 border-green-500 text-green-700">Parol yangilandi</Alert>}

      <div className="space-y-2">
        <Label htmlFor="password">Yangi parol</Label>
        <Input id="password" name="password" type="password" minLength={6} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Parolni tasdiqlang</Label>
        <Input id="confirm" name="confirm" type="password" minLength={6} required />
      </div>

      <SubmitButton />
    </form>
  );
}
