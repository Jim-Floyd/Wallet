'use client';

import { useTranslations } from 'next-intl';
import { useFormState, useFormStatus } from 'react-dom';
import { useState, useEffect } from 'react';
import { register, sendPhoneOtp, verifyPhoneOtp, type AuthState } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Loader2, Mail, Phone, ArrowLeft } from 'lucide-react';

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}

function EmailSuccess({ email }: { email: string }) {
  const t = useTranslations('auth');
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="rounded-full bg-green-100 p-4">
        <Mail className="h-10 w-10 text-green-600" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-base">{t('checkYourEmail')}</p>
        <p className="text-sm text-muted-foreground">
          {t('confirmEmailSentTo')} <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>
      <Alert className="text-sm text-left bg-amber-50 border-amber-200 text-amber-800 py-2">
        {t('checkSpamFolder')}
      </Alert>
      <p className="text-xs text-muted-foreground">{t('afterConfirmLogin')}</p>
    </div>
  );
}

function EmailTab({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [state, action] = useFormState<AuthState, FormData>(register, null);

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  if (state?.success) return <EmailSuccess email={email} />;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      {state?.error && (
        <Alert variant="destructive" className="text-sm py-2">{state.error}</Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email-fullName">{t('fullName')}</Label>
        <Input id="email-fullName" name="fullName" type="text" placeholder="Ism Familiya" required autoComplete="name" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email-email">{t('email')}</Label>
        <Input
          id="email-email" name="email" type="email" placeholder="email@example.com"
          required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email-password">{t('password')}</Label>
        <Input
          id="email-password" name="password" type="password" placeholder="••••••••"
          required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email-confirm">{t('confirmPassword')}</Label>
        <Input
          id="email-confirm" name="confirmPassword" type="password" placeholder="••••••••"
          required minLength={6} value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          className={passwordMismatch ? 'border-destructive' : ''}
        />
        {passwordMismatch && (
          <p className="text-xs text-destructive">{t('passwordMismatch')}</p>
        )}
      </div>

      <SubmitButton label={t('register')} disabled={passwordMismatch} />
      <p className="text-xs text-center text-muted-foreground">{t('agreeTerms')}</p>
    </form>
  );
}

function PhoneTab({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');

  const [sendState, sendAction] = useFormState<AuthState, FormData>(sendPhoneOtp, null);
  const [verifyState, verifyAction] = useFormState<AuthState, FormData>(verifyPhoneOtp, null);

  useEffect(() => {
    if (sendState?.success && sendState.phone) {
      setPhone(sendState.phone);
      setStep('verify');
    }
  }, [sendState]);

  if (step === 'verify') {
    return (
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="fullName" value={fullName} />
        <input type="hidden" name="locale" value={locale} />

        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-center">
          <p className="text-muted-foreground">{t('smsSentTo')}</p>
          <p className="font-semibold mt-0.5">{phone}</p>
        </div>

        {verifyState?.error && (
          <Alert variant="destructive" className="text-sm py-2">{verifyState.error}</Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="otp">{t('smsCode')}</Label>
          <Input
            id="otp" name="token" type="text" inputMode="numeric"
            placeholder="123456" maxLength={6} required autoComplete="one-time-code"
            className="text-center text-2xl tracking-widest font-mono"
          />
          <p className="text-xs text-muted-foreground">{t('smsCodeHint')}</p>
        </div>

        <SubmitButton label={t('verify')} />

        <button
          type="button"
          onClick={() => setStep('input')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mx-auto"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('changPhone')}
        </button>
      </form>
    );
  }

  return (
    <form action={sendAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      {sendState?.error && (
        <Alert variant="destructive" className="text-sm py-2">{sendState.error}</Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="phone-fullName">{t('fullName')}</Label>
        <Input
          id="phone-fullName" name="fullName" type="text" placeholder="Ism Familiya"
          required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone-number">{t('phoneNumber')}</Label>
        <div className="flex gap-2">
          <span className="flex items-center px-3 rounded-md border bg-muted text-sm font-medium text-muted-foreground select-none">
            +998
          </span>
          <Input
            id="phone-number" name="phone" type="tel" inputMode="numeric"
            placeholder="90 123 45 67" required autoComplete="tel"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">{t('phoneHint')}</p>
      </div>

      <SubmitButton label={t('sendSmsCode')} />
      <p className="text-xs text-center text-muted-foreground">{t('agreeTerms')}</p>
    </form>
  );
}

export function RegisterForm({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<'email' | 'phone'>('email');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setMode('email')}
          className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === 'email'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Mail className="h-4 w-4" />
          {t('email')}
        </button>
        <button
          type="button"
          onClick={() => setMode('phone')}
          className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === 'phone'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Phone className="h-4 w-4" />
          {t('phoneNumber')}
        </button>
      </div>

      {mode === 'email' ? <EmailTab locale={locale} /> : <PhoneTab locale={locale} />}
    </div>
  );
}
