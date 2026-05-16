import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('auth');

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">{t('login')}</CardTitle>
        <CardDescription>{t('loginDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm locale={locale} />
      </CardContent>
      <CardFooter className="flex flex-col gap-3 text-sm text-center">
        <Link
          href={`/${locale}/auth/forgot-password`}
          className="text-primary hover:underline"
        >
          {t('forgotPassword')}
        </Link>
        <p className="text-muted-foreground">
          {t('noAccount')}{' '}
          <Link
            href={`/${locale}/auth/register`}
            className="text-primary font-medium hover:underline"
          >
            {t('register')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
