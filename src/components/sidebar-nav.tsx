'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { logout } from '@/lib/actions/auth';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Bot,
  PiggyBank,
  Target,
  CreditCard,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';

export function SidebarNav() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();

  const navItems = [
    { href: `/${locale}/dashboard`, label: t('dashboard'), icon: LayoutDashboard },
    { href: `/${locale}/transactions`, label: t('transactions'), icon: ArrowLeftRight },
    { href: `/${locale}/wallets`, label: t('wallets'), icon: Wallet },
    { href: `/${locale}/ai`, label: t('ai'), icon: Bot },
    { href: `/${locale}/budget`, label: t('budget'), icon: PiggyBank },
    { href: `/${locale}/goals`, label: t('goals'), icon: Target },
    { href: `/${locale}/billing`, label: t('billing'), icon: CreditCard },
    { href: `/${locale}/referral`, label: t('referral'), icon: Users },
    { href: `/${locale}/settings`, label: t('settings'), icon: Settings },
  ];

  return (
    <nav className="flex flex-col gap-1 p-2 h-full">
      <div className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="border-t pt-2 mt-2">
        <form action={logout.bind(null, locale)}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t('logout')}
          </button>
        </form>
      </div>
    </nav>
  );
}
