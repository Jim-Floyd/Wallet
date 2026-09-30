import { getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';

export default async function BillingPage() {
  const t = await getTranslations('nav');
  const tc = await getTranslations('common');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('billing')}</h1>

      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">{tc('comingSoon')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
