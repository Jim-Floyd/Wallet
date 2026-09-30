import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { logout } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('settings');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  const email = user.email ?? '';
  const name = dbUser?.name ?? user.user_metadata?.full_name ?? '';
  const currency = dbUser?.currency ?? 'UZS';

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm name={name} email={email} currency={currency} />
        </CardContent>
      </Card>

      {user.app_metadata?.provider === 'email' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('password')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form action={logout.bind(null, locale)}>
            <Button type="submit" variant="destructive" className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              {t('logout')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
