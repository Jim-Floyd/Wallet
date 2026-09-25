import { cn } from '@/lib/utils';
import { getWalletIcon } from '@/lib/wallet-icons';

const CURRENCY_COLORS: Record<string, string> = {
  UZS: 'bg-emerald-500',
  USD: 'bg-blue-500',
  EUR: 'bg-indigo-500',
  RUB: 'bg-red-500',
};

const CURRENCY_FLAGS: Record<string, string> = {
  UZS: '🇺🇿',
  USD: '🇺🇸',
  EUR: '🇪🇺',
  RUB: '🇷🇺',
};

// Hamyon belgisi: tanlangan ikonka rangli fonda; ikonka bo'lmasa — valyuta bayrog'i
export function WalletAvatar({
  icon,
  color,
  currency,
  className,
}: {
  icon: string | null;
  color: string | null;
  currency: string;
  className?: string;
}) {
  const Icon = getWalletIcon(icon);
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg',
        !color && (CURRENCY_COLORS[currency] ?? 'bg-gray-500'),
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {Icon ? <Icon className="h-[55%] w-[55%] text-white" /> : (CURRENCY_FLAGS[currency] ?? '💳')}
    </div>
  );
}
