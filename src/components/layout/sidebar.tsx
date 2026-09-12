"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';
import { 
  LayoutDashboard, ScanLine, ClipboardCheck, Package, 
  ShoppingCart, BarChart3, FileText, Scale, History,
  Users, ScrollText, User, LogOut, Shield, ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const navItems = [
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard, section: 'Enforcement' },
  { label: 'Scan Product', href: '/app/scan', icon: ScanLine, section: 'Enforcement' },
  { label: 'Review Queue', href: '/app/review', icon: ClipboardCheck, section: 'Enforcement', badge: '4' },
  { label: 'Products', href: '/app/products', icon: Package, section: 'Enforcement' },
  { label: 'E-commerce', href: '/app/ecommerce', icon: ShoppingCart, section: 'Enforcement' },
  { label: 'Analytics', href: '/app/analytics', icon: BarChart3, section: 'Intelligence' },
  { label: 'Reports', href: '/app/reports', icon: FileText, section: 'Intelligence' },
  { label: 'Rules', href: '/app/rules', icon: Scale, section: 'Administration' },
  { label: 'Rule Versions', href: '/app/rule-versions', icon: History, section: 'Administration' },
  { label: 'Users', href: '/app/admin/users', icon: Users, section: 'Administration' },
  { label: 'Audit Log', href: '/app/admin/audit-log', icon: ScrollText, section: 'Administration' },
];

export function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const pathname = usePathname();
  
  const grouped = navItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <div className={cn("border-r bg-white flex flex-col transition-all duration-300", collapsed ? "w-[64px]" : "w-[264px]")}>
      <div className="h-[64px] border-b flex items-center px-4 gap-3">
        <div className="w-8 h-8 rounded-lg gov-gradient flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[14px] leading-none">PackComply</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">SIH 26034</div>
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => setCollapsed(!collapsed)}>
          <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {Object.entries(grouped).map(([section, items]) => (
          <div key={section}>
            {!collapsed && <div className="px-3 mb-2 text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">{section}</div>}
            <div className="space-y-1">
              {items.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active ? "bg-slate-900 text-white shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    collapsed && "justify-center px-2"
                  )}>
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {!collapsed && (item as any).badge && (
                      <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{(item as any).badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-3 space-y-1">
        <Link href="/app/profile" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent", collapsed && "justify-center")}>
          <User className="w-4 h-4" /> {!collapsed && "Profile"}
        </Link>
        <button onClick={() => { localStorage.removeItem('token'); window.location.href='/login'; }} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent w-full text-left", collapsed && "justify-center")}>
          <LogOut className="w-4 h-4" /> {!collapsed && "Logout"}
        </button>
      </div>
    </div>
  );
}
