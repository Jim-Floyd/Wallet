import {
  Award, Baby, BookOpen, Briefcase, Bus, Car, CircleEllipsis, Coffee, Coins, Dog, Dumbbell, Film, Fuel,
  Gamepad2, Gift, GraduationCap, HeartPulse, House, Landmark, Laptop, Lightbulb, PartyPopper, PiggyBank, Pill,
  Plane, Receipt, Scissors, Shirt, ShoppingBasket, ShoppingCart, Smartphone, Sparkles, Store, TrendingUp,
  Utensils, Wallet, Wifi, Wrench, type LucideIcon,
} from 'lucide-react';

export const INCOME_DEFAULTS = ['Maosh', 'Bonus', 'Freelance', 'Biznes', "Sovg'a", 'Boshqa'];
export const EXPENSE_DEFAULTS = [
  'Oziq-ovqat', 'Transport', 'Uy-joy', 'Kommunal', 'Kiyim', "Sog'liq", "Ta'lim", "Ko'ngil ochar", 'Restoran', 'Sport', 'Boshqa',
];

export type CategoryIconDef = { key: string; label: string; Icon: LucideIcon; color: string };

// Category.icon maydonida kalit saqlanadi. color — belgining o'z rangi (fon shu rangning och tusi)
export const CATEGORY_ICONS: CategoryIconDef[] = [
  { key: 'shopping-basket', label: 'Oziq-ovqat', Icon: ShoppingBasket, color: '#16a34a' },
  { key: 'shopping-cart', label: 'Xaridlar', Icon: ShoppingCart, color: '#0d9488' },
  { key: 'utensils', label: 'Restoran', Icon: Utensils, color: '#ea580c' },
  { key: 'coffee', label: 'Kafe', Icon: Coffee, color: '#92400e' },
  { key: 'bus', label: 'Transport', Icon: Bus, color: '#2563eb' },
  { key: 'car', label: 'Mashina / taksi', Icon: Car, color: '#ca8a04' },
  { key: 'fuel', label: "Yoqilg'i", Icon: Fuel, color: '#dc2626' },
  { key: 'plane', label: 'Sayohat', Icon: Plane, color: '#0284c7' },
  { key: 'house', label: 'Uy-joy', Icon: House, color: '#7c3aed' },
  { key: 'lightbulb', label: 'Kommunal', Icon: Lightbulb, color: '#d97706' },
  { key: 'wifi', label: 'Internet', Icon: Wifi, color: '#0891b2' },
  { key: 'smartphone', label: 'Telefon', Icon: Smartphone, color: '#4f46e5' },
  { key: 'shirt', label: 'Kiyim', Icon: Shirt, color: '#db2777' },
  { key: 'scissors', label: "Go'zallik", Icon: Scissors, color: '#c026d3' },
  { key: 'heart-pulse', label: "Sog'liq", Icon: HeartPulse, color: '#e11d48' },
  { key: 'pill', label: 'Dori', Icon: Pill, color: '#059669' },
  { key: 'graduation-cap', label: "Ta'lim", Icon: GraduationCap, color: '#1d4ed8' },
  { key: 'book-open', label: 'Kitob', Icon: BookOpen, color: '#9333ea' },
  { key: 'party-popper', label: "Ko'ngil ochar", Icon: PartyPopper, color: '#f59e0b' },
  { key: 'film', label: 'Kino', Icon: Film, color: '#be123c' },
  { key: 'gamepad', label: "O'yin", Icon: Gamepad2, color: '#6d28d9' },
  { key: 'dumbbell', label: 'Sport', Icon: Dumbbell, color: '#0f766e' },
  { key: 'baby', label: 'Bola', Icon: Baby, color: '#ec4899' },
  { key: 'dog', label: 'Uy hayvoni', Icon: Dog, color: '#a16207' },
  { key: 'wrench', label: "Ta'mir", Icon: Wrench, color: '#57534e' },
  { key: 'receipt', label: "To'lov / soliq", Icon: Receipt, color: '#475569' },
  { key: 'gift', label: "Sovg'a", Icon: Gift, color: '#e11d48' },
  { key: 'briefcase', label: 'Maosh', Icon: Briefcase, color: '#15803d' },
  { key: 'award', label: 'Bonus', Icon: Award, color: '#ca8a04' },
  { key: 'laptop', label: 'Freelance', Icon: Laptop, color: '#0369a1' },
  { key: 'store', label: 'Biznes', Icon: Store, color: '#7e22ce' },
  { key: 'trending-up', label: 'Investitsiya', Icon: TrendingUp, color: '#059669' },
  { key: 'piggy-bank', label: "Jamg'arma", Icon: PiggyBank, color: '#db2777' },
  { key: 'landmark', label: 'Bank', Icon: Landmark, color: '#334155' },
  { key: 'coins', label: 'Pul', Icon: Coins, color: '#b45309' },
  { key: 'wallet', label: 'Hamyon', Icon: Wallet, color: '#0f766e' },
  { key: 'sparkles', label: 'Maxsus', Icon: Sparkles, color: '#8b5cf6' },
  { key: 'other', label: 'Boshqa', Icon: CircleEllipsis, color: '#64748b' },
];

export const CATEGORY_ICON_KEYS = CATEGORY_ICONS.map(i => i.key);

// Standart kategoriyalar belgisi
const DEFAULT_ICONS: Record<string, string> = {
  'Maosh': 'briefcase',
  'Bonus': 'award',
  'Freelance': 'laptop',
  'Biznes': 'store',
  "Sovg'a": 'gift',
  'Boshqa': 'other',
  'Oziq-ovqat': 'shopping-basket',
  'Transport': 'bus',
  'Uy-joy': 'house',
  'Kommunal': 'lightbulb',
  'Kiyim': 'shirt',
  "Sog'liq": 'heart-pulse',
  "Ta'lim": 'graduation-cap',
  "Ko'ngil ochar": 'party-popper',
  'Restoran': 'utensils',
  'Sport': 'dumbbell',
};

// Belgisiz qo'lda qo'shilgan kategoriyalar uchun nomdan taxmin
const KEYWORDS: [RegExp, string][] = [
  [/yoqilg|benzin|gaz|metan|propan/i, 'fuel'],
  [/taksi|taxi|mashina|avto/i, 'car'],
  [/internet|wifi/i, 'wifi'],
  [/telefon|aloqa|mobil/i, 'smartphone'],
  [/dori|apteka|dorixona/i, 'pill'],
  [/kafe|qahva|coffee/i, 'coffee'],
  [/ovqat|non|market|bozor/i, 'shopping-basket'],
  [/kino|film/i, 'film'],
  [/sartarosh|go'zallik|salon/i, 'scissors'],
  [/bola|farzand|bog'cha/i, 'baby'],
  [/kitob/i, 'book-open'],
  [/ta'mir|remont/i, 'wrench'],
  [/soliq|jarima|to'lov/i, 'receipt'],
  [/ijara|kvartira/i, 'house'],
  [/boshlang'ich|qoldiq/i, 'wallet'],
];

export function categoryIconKey(name: string, customIcon?: string | null): string | null {
  if (customIcon && CATEGORY_ICON_KEYS.includes(customIcon)) return customIcon;
  if (DEFAULT_ICONS[name]) return DEFAULT_ICONS[name];
  return KEYWORDS.find(([re]) => re.test(name))?.[1] ?? null;
}

export function getCategoryIcon(key: string | null | undefined): CategoryIconDef | null {
  return CATEGORY_ICONS.find(i => i.key === key) ?? null;
}

// Belgi foni: o'z rangining och tusi (hex + alfa)
export const iconBg = (color: string) => `${color}1f`;
