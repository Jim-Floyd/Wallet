import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot } from 'lucide-react';

export default async function AiPage() {
  const t = await getTranslations('nav');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('ai')}</h1>

      <Card className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Moliyaviy Yordamchi
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">AI yordamchi tez orada ishga tushadi...</p>
        </CardContent>
      </Card>
    </div>
  );
}
