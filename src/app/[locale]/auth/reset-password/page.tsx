import { getTranslations } from 'next-intl/server';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('auth');

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">{t('newPassword')}</CardTitle>
        <CardDescription>{t('resetPassword')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm locale={locale} />
      </CardContent>
    </Card>
  );
}
