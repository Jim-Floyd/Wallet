'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Props {
  locale: string;
  filters: { type?: string; walletId?: string; from?: string; to?: string };
}

export function ExportButton({ locale, filters }: Props) {
  const handleExport = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val) params.set(key, val);
    });
    const qs = params.size ? `?${params}` : '';
    window.location.href = `/${locale}/transactions/export${qs}`;
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" />
      Excel
    </Button>
  );
}
