'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common');
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-semibold">{t('errorTitle')}</h2>
      <pre className="max-w-xl overflow-auto rounded bg-muted p-4 text-xs text-destructive">
        {error.message}
        {error.stack && '\n\n' + error.stack}
      </pre>
      <button onClick={reset} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">
        {t('retry')}
      </button>
    </div>
  );
}
