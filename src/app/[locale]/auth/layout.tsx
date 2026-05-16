import { LanguageSwitcher } from '@/components/language-switcher';
import { Wallet } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="flex h-14 items-center justify-between px-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg">Hamyon</span>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t bg-background">
        © {new Date().getFullYear()} Hamyon. Barcha huquqlar himoyalangan.
      </footer>
    </div>
  );
}
