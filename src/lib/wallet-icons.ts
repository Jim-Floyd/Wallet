import {
  Banknote, Briefcase, Car, Coins, CreditCard, Gem, Gift, GraduationCap, HeartPulse, House, Landmark,
  PiggyBank, Plane, ShoppingCart, Smartphone, Wallet, type LucideIcon,
} from 'lucide-react';

// Wallet.icon maydonida kalit saqlanadi (masalan "credit-card"). Nomi tarjimada: walletIcons.<key>
export const WALLET_ICONS: { key: string; Icon: LucideIcon }[] = [
  { key: 'credit-card', Icon: CreditCard },
  { key: 'banknote', Icon: Banknote },
  { key: 'wallet', Icon: Wallet },
  { key: 'landmark', Icon: Landmark },
  { key: 'piggy-bank', Icon: PiggyBank },
  { key: 'smartphone', Icon: Smartphone },
  { key: 'coins', Icon: Coins },
  { key: 'briefcase', Icon: Briefcase },
  { key: 'house', Icon: House },
  { key: 'car', Icon: Car },
  { key: 'plane', Icon: Plane },
  { key: 'shopping-cart', Icon: ShoppingCart },
  { key: 'gift', Icon: Gift },
  { key: 'graduation-cap', Icon: GraduationCap },
  { key: 'heart-pulse', Icon: HeartPulse },
  { key: 'gem', Icon: Gem },
];

export const WALLET_ICON_KEYS = WALLET_ICONS.map(i => i.key);

export function getWalletIcon(key: string | null | undefined): LucideIcon | null {
  return WALLET_ICONS.find(i => i.key === key)?.Icon ?? null;
}

export const WALLET_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6b7280'];
