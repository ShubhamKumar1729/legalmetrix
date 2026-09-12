"use client";
import { usePathname } from 'next/navigation';
import { Bell, Search, MapPin, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';

export function TopNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch {}
    }
    setOnline(navigator.onLine);
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
  }, []);

  const getTitle = () => {
    if (!pathname) return 'Dashboard';
    const parts = pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) return 'Dashboard';
    return last.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="h-[64px] border-b bg-white flex items-center justify-between px-6 gap-4">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="font-semibold text-[15px]">{getTitle()}</h1>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Legal Metrology • Packaged Commodities Rules, 2011</span>
            <span className="hidden md:inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> Ludhiana, Punjab</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${online ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {online ? 'Online' : 'Offline'}
          </div>
        </div>

        <div className="relative hidden lg:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products, inspections..." className="pl-9 w-[260px] h-9 bg-muted/50" />
        </div>

        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <div className="flex items-center gap-2 pl-3 border-l">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-medium">
            {user?.name?.charAt(0) || 'R'}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-medium leading-none">{user?.name || 'Rajesh Kumar'}</div>
            <div className="text-xs text-muted-foreground">{user?.role?.replace('_',' ') || 'Enforcement Officer'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
