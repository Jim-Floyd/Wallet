import { getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default async function GoalsPage() {
  const t = await getTranslations('goals');
  const tc = await getTranslations('common');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('addGoal')}
        </Button>
      </div>

      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">{tc('noData')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
