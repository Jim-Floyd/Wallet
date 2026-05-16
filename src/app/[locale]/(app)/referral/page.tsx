import { getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';

export default async function ReferralPage() {
  const t = await getTranslations('nav');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('referral')}</h1>

      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">Referral tizimi tez orada...</p>
        </CardContent>
      </Card>
    </div>
  );
}
