import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('auth');

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">{t('resetPassword')}</CardTitle>
        <CardDescription>{t('forgotDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm locale={locale} />
      </CardContent>
      <CardFooter className="text-sm text-center">
        <Link
          href={`/${locale}/auth/login`}
          className="text-primary font-medium hover:underline w-full"
        >
          ← {t('backToLogin')}
        </Link>
      </CardFooter>
    </Card>
  );
}
