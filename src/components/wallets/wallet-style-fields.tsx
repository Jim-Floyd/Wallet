'use client';

import { Label } from '@/components/ui/label';
import { WALLET_COLORS, WALLET_ICONS } from '@/lib/wallet-icons';
import { WalletAvatar } from '@/components/wallets/wallet-avatar';
import { cn } from '@/lib/utils';

// Rang + ikonka tanlash. Qiymatlar hidden input orqali FormData ga ("color", "icon") tushadi.
export function WalletStyleFields({
  color,
  icon,
  currency,
  onColorChange,
  onIconChange,
}: {
  color: string;
  icon: string | null;
  currency: string;
  onColorChange: (color: string) => void;
  onIconChange: (icon: string | null) => void;
}) {
  return (
    <>
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="icon" value={icon ?? ''} />

      <div className="space-y-2">
        <Label>Rang</Label>
        <div className="flex flex-wrap gap-2">
          {WALLET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => onColorChange(c)}
              className={cn(
                'h-7 w-7 rounded-full transition-transform',
                color === c && 'scale-125 ring-2 ring-offset-1 ring-foreground',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Belgi</Label>
          <WalletAvatar icon={icon} color={color} currency={currency} className="h-8 w-8" />
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {/* Belgisiz — valyuta bayrog'i ko'rinadi */}
          <button
            type="button"
            title="Valyuta bayrog'i"
            onClick={() => onIconChange(null)}
            className={cn(
              'flex aspect-square items-center justify-center rounded-lg border text-xs text-muted-foreground transition-colors',
              icon === null ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
            )}
          >
            —
          </button>
          {WALLET_ICONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => onIconChange(key)}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg border transition-colors',
                icon === key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
