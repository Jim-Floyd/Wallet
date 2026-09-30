import {
  Award, Baby, BookOpen, Briefcase, Bus, Car, CircleEllipsis, Coffee, Coins, Dog, Dumbbell, Film, Fuel,
  Gamepad2, Gift, GraduationCap, HeartPulse, House, Landmark, Laptop, Lightbulb, PartyPopper, PiggyBank, Pill,
  Plane, Receipt, Scissors, Shirt, ShoppingBasket, ShoppingCart, Smartphone, Sparkles, Store, TrendingUp,
  Utensils, Wallet, Wifi, Wrench, type LucideIcon,
} from 'lucide-react';
import type { Translate } from '@/lib/intl';

// Standart kategoriyalar: bazada o'zbekcha nomi saqlanadi (eski yozuvlar bilan mos),
// ekranda esa `defaultCategories.<id>` tarjimasi ko'rsatiladi
const DEFAULT_CATEGORIES: { name: string; id: string; icon: string }[] = [
  { name: 'Maosh', id: 'salary', icon: 'briefcase' },
  { name: 'Bonus', id: 'bonus', icon: 'award' },
  { name: 'Freelance', id: 'freelance', icon: 'laptop' },
  { name: 'Biznes', id: 'business', icon: 'store' },
  { name: "Sovg'a", id: 'gift', icon: 'gift' },
  { name: 'Boshqa', id: 'other', icon: 'other' },
  { name: 'Oziq-ovqat', id: 'food', icon: 'shopping-basket' },
  { name: 'Transport', id: 'transport', icon: 'bus' },
  { name: 'Uy-joy', id: 'housing', icon: 'house' },
  { name: 'Kommunal', id: 'utilities', icon: 'lightbulb' },
  { name: 'Kiyim', id: 'clothing', icon: 'shirt' },
  { name: "Sog'liq", id: 'health', icon: 'heart-pulse' },
  { name: "Ta'lim", id: 'education', icon: 'graduation-cap' },
  { name: "Ko'ngil ochar", id: 'entertainment', icon: 'party-popper' },
  { name: 'Restoran', id: 'restaurant', icon: 'utensils' },
  { name: 'Sport', id: 'sport', icon: 'dumbbell' },
];

export const INCOME_DEFAULTS = ['Maosh', 'Bonus', 'Freelance', 'Biznes', "Sovg'a", 'Boshqa'];
export const EXPENSE_DEFAULTS = [
  'Oziq-ovqat', 'Transport', 'Uy-joy', 'Kommunal', 'Kiyim', "Sog'liq", "Ta'lim", "Ko'ngil ochar", 'Restoran', 'Sport', 'Boshqa',
];

// Kategoriya nomini ko'rsatish: standart bo'lsa tarjima, foydalanuvchiniki bo'lsa o'zi. t — "defaultCategories"
export function categoryName(name: string, t: Translate) {
  const def = DEFAULT_CATEGORIES.find(c => c.name === name);
  return def ? t(def.id) : name;
}

export type CategoryIconDef = { key: string; Icon: LucideIcon; color: string };

// Category.icon maydonida kalit saqlanadi. Nomi tarjimada: categoryIcons.<key>.
// color — belgining o'z rangi (fon shu rangning och tusi)
export const CATEGORY_ICONS: CategoryIconDef[] = [
  { key: 'shopping-basket', Icon: ShoppingBasket, color: '#16a34a' },
  { key: 'shopping-cart', Icon: ShoppingCart, color: '#0d9488' },
  { key: 'utensils', Icon: Utensils, color: '#ea580c' },
  { key: 'coffee', Icon: Coffee, color: '#92400e' },
  { key: 'bus', Icon: Bus, color: '#2563eb' },
  { key: 'car', Icon: Car, color: '#ca8a04' },
  { key: 'fuel', Icon: Fuel, color: '#dc2626' },
  { key: 'plane', Icon: Plane, color: '#0284c7' },
  { key: 'house', Icon: House, color: '#7c3aed' },
  { key: 'lightbulb', Icon: Lightbulb, color: '#d97706' },
  { key: 'wifi', Icon: Wifi, color: '#0891b2' },
  { key: 'smartphone', Icon: Smartphone, color: '#4f46e5' },
  { key: 'shirt', Icon: Shirt, color: '#db2777' },
  { key: 'scissors', Icon: Scissors, color: '#c026d3' },
  { key: 'heart-pulse', Icon: HeartPulse, color: '#e11d48' },
  { key: 'pill', Icon: Pill, color: '#059669' },
  { key: 'graduation-cap', Icon: GraduationCap, color: '#1d4ed8' },
  { key: 'book-open', Icon: BookOpen, color: '#9333ea' },
  { key: 'party-popper', Icon: PartyPopper, color: '#f59e0b' },
  { key: 'film', Icon: Film, color: '#be123c' },
  { key: 'gamepad', Icon: Gamepad2, color: '#6d28d9' },
  { key: 'dumbbell', Icon: Dumbbell, color: '#0f766e' },
  { key: 'baby', Icon: Baby, color: '#ec4899' },
  { key: 'dog', Icon: Dog, color: '#a16207' },
  { key: 'wrench', Icon: Wrench, color: '#57534e' },
  { key: 'receipt', Icon: Receipt, color: '#475569' },
  { key: 'gift', Icon: Gift, color: '#e11d48' },
  { key: 'briefcase', Icon: Briefcase, color: '#15803d' },
  { key: 'award', Icon: Award, color: '#ca8a04' },
  { key: 'laptop', Icon: Laptop, color: '#0369a1' },
  { key: 'store', Icon: Store, color: '#7e22ce' },
  { key: 'trending-up', Icon: TrendingUp, color: '#059669' },
  { key: 'piggy-bank', Icon: PiggyBank, color: '#db2777' },
  { key: 'landmark', Icon: Landmark, color: '#334155' },
  { key: 'coins', Icon: Coins, color: '#b45309' },
  { key: 'wallet', Icon: Wallet, color: '#0f766e' },
  { key: 'sparkles', Icon: Sparkles, color: '#8b5cf6' },
  { key: 'other', Icon: CircleEllipsis, color: '#64748b' },
];

export const CATEGORY_ICON_KEYS = CATEGORY_ICONS.map(i => i.key);

// Belgisiz qo'lda qo'shilgan kategoriyalar uchun nomdan taxmin (o'zbek, rus, ingliz)
const KEYWORDS: [RegExp, string][] = [
  [/yoqilg|benzin|gaz|metan|propan|бензин|топлив|fuel|\bgas\b/i, 'fuel'],
  [/taksi|taxi|mashina|avto|такси|машин|авто|\bcar\b/i, 'car'],
  [/internet|wifi|интернет/i, 'wifi'],
  [/telefon|aloqa|mobil|телефон|связь|phone/i, 'smartphone'],
  [/dori|apteka|dorixona|аптек|лекарств|pharmacy|medicine/i, 'pill'],
  [/kafe|qahva|coffee|кафе|кофе|cafe/i, 'coffee'],
  [/ovqat|non|market|bozor|продукт|еда|рынок|grocer|food/i, 'shopping-basket'],
  [/kino|film|кино|movie/i, 'film'],
  [/sartarosh|go'zallik|salon|парикмах|красот|beauty|salon/i, 'scissors'],
  [/bola|farzand|bog'cha|дет|ребен|child|\bkids?\b/i, 'baby'],
  [/kitob|книг|\bbooks?\b/i, 'book-open'],
  [/ta'mir|remont|ремонт|repair/i, 'wrench'],
  [/soliq|jarima|to'lov|налог|штраф|\btax\b|\bfines?\b/i, 'receipt'],
  [/ijara|kvartira|аренд|квартир|\brent\b/i, 'house'],
  [/boshlang'ich|qoldiq|начальн|остаток|initial|opening/i, 'wallet'],
];

export function categoryIconKey(name: string, customIcon?: string | null): string | null {
  if (customIcon && CATEGORY_ICON_KEYS.includes(customIcon)) return customIcon;
  const def = DEFAULT_CATEGORIES.find(c => c.name === name);
  if (def) return def.icon;
  return KEYWORDS.find(([re]) => re.test(name))?.[1] ?? null;
}

export function getCategoryIcon(key: string | null | undefined): CategoryIconDef | null {
  return CATEGORY_ICONS.find(i => i.key === key) ?? null;
}

// Belgi foni: o'z rangining och tusi (hex + alfa)
export const iconBg = (color: string) => `${color}1f`;
