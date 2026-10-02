'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { importTransactions, type ImportState } from '@/lib/actions/import';
import { IMPORT_MAX_BYTES } from '@/lib/import-limits';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

function SubmitButton() {
  const t = useTranslations('import');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
      {t('upload')}
    </Button>
  );
}

export function ImportDialog({ locale }: { locale: string }) {
  const t = useTranslations('import');
  const [open, setOpen] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const [state, action] = useFormState<ImportState, FormData>(importTransactions, null);
  const form = useRef<HTMLFormElement>(null);

  // Muvaffaqiyatli yuklangach fayl tanlovini tozalash — xuddi shu faylni tasodifan qayta yuklamaslik uchun
  useEffect(() => {
    if (state?.imported) form.current?.reset();
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Upload className="mr-2 h-4 w-4" />
        {t('button')}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm">{t('step1')}</p>
          <a
            href={`/${locale}/transactions/import-template`}
            download
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full' })}
          >
            <Download className="mr-2 h-4 w-4" />
            {t('downloadTemplate')}
          </a>
        </div>

        <form ref={form} action={action} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="import-file">{t('step2')}</Label>
            <input
              id="import-file"
              name="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              required
              onChange={(e) => {
                const tooBig = (e.target.files?.[0]?.size ?? 0) > IMPORT_MAX_BYTES;
                setSizeError(tooBig);
                if (tooBig) e.target.value = '';
              }}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </div>

          {sizeError && <Alert variant="destructive" className="py-2 text-sm">{t('fileTooLarge')}</Alert>}

          {state?.error && (
            <Alert variant="destructive" className="py-2 text-sm">
              <p className="font-medium">{state.error}</p>
              {state.rowErrors && state.rowErrors.length > 0 && (
                <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-4 text-xs">
                  {state.rowErrors.map((e) => <li key={e}>{e}</li>)}
                  {!!state.moreErrors && <li className="list-none">{t('moreErrors', { count: state.moreErrors })}</li>}
                </ul>
              )}
            </Alert>
          )}

          {state?.imported != null && (
            <Alert className="py-2 text-sm text-green-700 dark:text-green-400">
              {t('success', { count: state.imported })}
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">{t('duplicateHint')}</p>
          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
