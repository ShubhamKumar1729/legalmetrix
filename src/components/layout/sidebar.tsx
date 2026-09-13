'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  PlusCircle,
  Scale,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  User,
  ClipboardList,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { useSession } from '@/components/session-provider';

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  badgeKey?: 'review';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { label: 'New Inspection', href: '/app/inspections/new', icon: PlusCircle, permission: 'inspection:create' },
  { label: 'Inspections', href: '/app/inspections', icon: ClipboardList, permission: 'inspection:read' },
  { label: 'Review', href: '/app/review', icon: ClipboardCheck, permission: 'review:read', badgeKey: 'review' },
  { label: 'Products', href: '/app/products', icon: Package, permission: 'product:read' },
  { label: 'Reports', href: '/app/reports', icon: FileText, permission: 'report:read' },
  { label: 'E-commerce', href: '/app/ecommerce', icon: ShoppingCart, permission: 'ecommerce:analyze' },
  { label: 'Rules', href: '/app/rules', icon: Scale, permission: 'rule:read' },
  { label: 'Admin', href: '/app/admin', icon: Settings, permission: 'user:read' },
  { label: 'Compliance AI', href: '/app/assistant', icon: Sparkles, permission: 'inspection:read' },
];

export function Sidebar({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}) {
  const pathname = usePathname();
  const { can, session } = useSession();
  const [pendingReview, setPendingReview] = useState(0);

  useEffect(() => {
    if (!can('review:read')) return;
    let active = true;
    fetch('/api/notifications', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (!active || !body.success) return;
        const items = (body.data.items || []).filter((item: { type: string }) => item.type === 'REVIEW');
        setPendingReview(items.length);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [can, pathname]);

  const visible = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/login';
  }

  return (
    <div className={cn('flex h-screen flex-col border-r bg-white transition-all', collapsed ? 'w-[64px]' : 'w-[248px]')}>
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="gov-gradient flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
          <Shield className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold leading-none">LegalMetrix</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Compliance</div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto hidden h-7 w-7 md:flex"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {visible.map((item) => {
          const active = pathname?.startsWith(item.href);
          const badge = item.badgeKey === 'review' ? pendingReview : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-slate-900 text-white' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && badge > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t p-2">
        {session && !collapsed && (
          <div className="px-3 pb-2">
            <div className="truncate text-sm font-medium">{session.user.name}</div>
            <div className="text-xs text-muted-foreground">{session.simpleRoleLabel}</div>
          </div>
        )}
        <Link
          href="/app/profile"
          className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent', collapsed && 'justify-center')}
        >
          <User className="h-4 w-4" />
          {!collapsed && 'Profile'}
        </Link>
        <button
          type="button"
          onClick={logout}
          className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent', collapsed && 'justify-center')}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </div>
  );
}
