import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { RegisterForm } from '@/components/auth/register-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('auth');

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">{t('register')}</CardTitle>
        <CardDescription>{t('registerDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm locale={locale} />
      </CardContent>
      <CardFooter className="text-sm text-center">
        <p className="text-muted-foreground w-full">
          {t('haveAccount')}{' '}
          <Link
            href={`/${locale}/auth/login`}
            className="text-primary font-medium hover:underline"
          >
            {t('login')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
