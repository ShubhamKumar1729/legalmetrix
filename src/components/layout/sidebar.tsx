'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';
import {
  ScanLine, ClipboardCheck, FileText, Package, ShoppingCart,
  BarChart3, Scale, History, Users, ScrollText, User as UserIcon,
  LogOut, ShieldCheck, ChevronLeft, BookOpen, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Sidebar is organized the way the job is done, not by data model:
 *  START HERE  → the guide
 *  YOUR WORK   → the numbered daily flow (scan → review → report)
 *  LOOK AROUND → reference data (products, online listings, analytics)
 *  SETUP       → admin-only configuration
 */
const navItems: {
  label: string;
  href: string;
  icon: any;
  section: string;
  plain?: string;
  countKey?: 'pendingReviews';
}[] = [
  { label: 'Start Here', href: '/app/guide', icon: BookOpen, section: 'New to LegalMetrix?', plain: 'A 2-minute tour of how everything fits together' },

  { label: 'Dashboard', href: '/app/dashboard', icon: BarChart3, section: '1 · Your daily flow' },
  { label: 'New Scan', href: '/app/scan', icon: ScanLine, section: '1 · Your daily flow', plain: 'Photograph a package and let the AI read it' },
  { label: 'Review Queue', href: '/app/review', icon: ClipboardCheck, section: '1 · Your daily flow', plain: 'Decisions waiting on a human', countKey: 'pendingReviews' },
  { label: 'Reports', href: '/app/reports', icon: FileText, section: '1 · Your daily flow', plain: 'Exportable, evidence-backed results' },

  { label: 'Products', href: '/app/products', icon: Package, section: '2 · Look around' },
  { label: 'Online Listings', href: '/app/ecommerce', icon: ShoppingCart, section: '2 · Look around', plain: 'Check web listings against the physical pack' },
  { label: 'Trends & Risk', href: '/app/analytics', icon: BarChart3, section: '2 · Look around', plain: 'Who violates most, and what to inspect next' },

  { label: 'Rules Library', href: '/app/rules', icon: Scale, section: '3 · Setup' },
  { label: 'Rule Versions', href: '/app/rule-versions', icon: History, section: '3 · Setup', plain: 'Which checklist edition was used when' },
  { label: 'Users', href: '/app/admin/users', icon: Users, section: '3 · Setup' },
  { label: 'Activity Log', href: '/app/admin/audit-log', icon: ScrollText, section: '3 · Setup', plain: 'Who did what, in order — cannot be edited' },
  { label: 'Settings', href: '/app/admin/settings', icon: Settings, section: '3 · Setup', plain: 'Thresholds, scoring and AI model connection' },
];

export function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const pathname = usePathname();
  const [pendingReviews, setPendingReviews] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.success) setPendingReviews(d.data?.kpis?.pendingReviews ?? 0); })
      .catch(() => {});
  }, [pathname]);

  const grouped = navItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className={cn('border-r bg-white flex flex-col transition-all duration-300 flex-shrink-0', collapsed ? 'w-[64px]' : 'w-[264px]')}>
      <div className="h-[64px] border-b flex items-center px-4 gap-3">
        <div className="w-8 h-8 rounded-lg brand-gradient flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[14px] leading-none">LegalMetrix</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Scan · Review · Report</div>
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand menu' : 'Collapse menu'} aria-label="Toggle menu">
          <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5" aria-label="Main">
        {Object.entries(grouped).map(([section, items]) => (
          <div key={section}>
            {!collapsed && <div className="px-3 mb-1.5 text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">{section}</div>}
            <div className="space-y-1">
              {items.map((item) => {
                const active = item.href === '/app' ? pathname === '/app' : pathname?.startsWith(item.href);
                const count = item.countKey === 'pendingReviews' ? pendingReviews : null;
                return (
                  <Link key={item.href} href={item.href} title={item.plain} className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active ? 'bg-emerald-700 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    collapsed && 'justify-center px-2'
                  )}>
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="flex-1 min-w-0 truncate">{item.label}</span>}
                    {!collapsed && count !== null && count > 0 && (
                      <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full" title={`${count} waiting for review`}>{count}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-3 space-y-1">
        <Link href="/app/profile" className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent', collapsed && 'justify-center')}>
          <UserIcon className="w-4 h-4" /> {!collapsed && 'My Profile'}
        </Link>
        <button onClick={logout} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent w-full text-left', collapsed && 'justify-center')}>
          <LogOut className="w-4 h-4" /> {!collapsed && 'Sign Out'}
        </button>
      </div>
    </div>
  );
}
