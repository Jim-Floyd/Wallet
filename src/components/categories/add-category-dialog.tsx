'use client';

import { useState, useTransition } from 'react';
import { createCategory } from '@/lib/actions/category';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CATEGORY_ICONS, categoryIconKey, iconBg } from '@/lib/category-icons';
import { cn } from '@/lib/utils';
import { Plus, Loader2 } from 'lucide-react';

type Category = { id: string; name: string; icon: string | null };

export function AddCategoryDialog({ onCreated }: { onCreated: (category: Category) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, startSaving] = useTransition();

  // Belgi tanlanmagan bo'lsa — nomdan taxmin qilingani ko'rsatiladi
  const shownIcon = icon ?? categoryIconKey(name.trim());

  function reset() {
    setName('');
    setIcon(null);
    setError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation(); // tashqi tranzaksiya formasiga o'tib ketmasin
    const trimmed = name.trim();
    if (!trimmed) return;

    startSaving(async () => {
      const result = await createCategory(trimmed, icon);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      onCreated(result);
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" />}>
        <Plus className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Yangi kategoriya</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <Alert variant="destructive" className="text-sm py-2">{error}</Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nomi</Label>
            <Input
              id="cat-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kategoriya nomi..."
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label>Belgi</Label>
            <div className="grid max-h-44 grid-cols-7 gap-1.5 overflow-y-auto pr-1">
              {CATEGORY_ICONS.map(({ key, label, Icon, color }) => (
                <button
                  key={key}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => setIcon(key)}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-full transition-transform',
                    shownIcon === key ? 'scale-110 ring-2 ring-offset-1 ring-foreground' : 'hover:scale-105',
                  )}
                  style={{ backgroundColor: iconBg(color) }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Saqlash
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
