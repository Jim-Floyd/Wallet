'use client';

import { useTranslations } from 'next-intl';
import { useFormState, useFormStatus } from 'react-dom';
import { login, type AuthState } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const [state, action] = useFormState<AuthState, FormData>(login, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      {state?.error && (
        <Alert
          variant={state.error === 'email_not_confirmed' ? 'default' : 'destructive'}
          className={`text-sm py-2 ${state.error === 'email_not_confirmed' ? 'bg-amber-50 border-amber-200 text-amber-800' : ''}`}
        >
          {state.error === 'email_not_confirmed' ? t('emailNotConfirmed') : state.error}
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="email@example.com"
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
          minLength={6}
        />
      </div>

      <SubmitButton label={t('login')} />
    </form>
  );
}
