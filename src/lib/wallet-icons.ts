import {
  Banknote, Briefcase, Car, Coins, CreditCard, Gem, Gift, GraduationCap, HeartPulse, House, Landmark,
  PiggyBank, Plane, ShoppingCart, Smartphone, Wallet, type LucideIcon,
} from 'lucide-react';

// Wallet.icon maydonida kalit saqlanadi (masalan "credit-card")
export const WALLET_ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'credit-card', label: 'Karta', Icon: CreditCard },
  { key: 'banknote', label: 'Naqd pul', Icon: Banknote },
  { key: 'wallet', label: 'Hamyon', Icon: Wallet },
  { key: 'landmark', label: 'Bank', Icon: Landmark },
  { key: 'piggy-bank', label: "Jamg'arma", Icon: PiggyBank },
  { key: 'smartphone', label: 'Elektron hamyon', Icon: Smartphone },
  { key: 'coins', label: 'Tangalar', Icon: Coins },
  { key: 'briefcase', label: 'Ish', Icon: Briefcase },
  { key: 'house', label: 'Uy', Icon: House },
  { key: 'car', label: 'Mashina', Icon: Car },
  { key: 'plane', label: 'Sayohat', Icon: Plane },
  { key: 'shopping-cart', label: 'Xaridlar', Icon: ShoppingCart },
  { key: 'gift', label: "Sovg'a", Icon: Gift },
  { key: 'graduation-cap', label: "Ta'lim", Icon: GraduationCap },
  { key: 'heart-pulse', label: "Sog'liq", Icon: HeartPulse },
  { key: 'gem', label: 'Qimmatbaho', Icon: Gem },
];

export const WALLET_ICON_KEYS = WALLET_ICONS.map(i => i.key);

export function getWalletIcon(key: string | null | undefined): LucideIcon | null {
  return WALLET_ICONS.find(i => i.key === key)?.Icon ?? null;
}

export const WALLET_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6b7280'];
