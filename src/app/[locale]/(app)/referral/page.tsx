import { getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';
import { StickyHeader } from '@/components/sticky-header';

export default async function ReferralPage() {
  const t = await getTranslations('nav');
  const tc = await getTranslations('common');

  return (
    <div className="space-y-6">
      <StickyHeader>
        <h1 className="text-2xl font-bold">{t('referral')}</h1>
      </StickyHeader>

      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">{tc('comingSoon')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
