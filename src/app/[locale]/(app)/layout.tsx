import { SidebarNav } from '@/components/sidebar-nav';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Wallet } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Wallet className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Hamyon</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-2 md:hidden">
            <Wallet className="h-5 w-5 text-primary" />
            <span className="font-bold">Hamyon</span>
          </div>
          <div className="ml-auto">
            <LanguageSwitcher />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
