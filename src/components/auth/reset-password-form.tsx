'use client';

import { useTranslations } from 'next-intl';
import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { resetPassword, type AuthState } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}

export function ResetPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, action] = useFormState<AuthState, FormData>(resetPassword, null);

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      {state?.error && (
        <Alert variant="destructive" className="text-sm py-2">
          {state.error}
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">{t('newPassword')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          className={passwordMismatch ? 'border-destructive' : ''}
        />
        {passwordMismatch && (
          <p className="text-xs text-destructive">{t('passwordMismatch')}</p>
        )}
      </div>

      <SubmitButton label={t('resetPassword')} disabled={passwordMismatch} />
    </form>
  );
}
