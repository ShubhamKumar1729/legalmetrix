'use client';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Search, Wifi, WifiOff, CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/** Friendly page names instead of URL segments — new users should never see raw route ids. */
const TITLES: Record<string, { title: string; plain: string }> = {
  '/app/dashboard': { title: 'Dashboard', plain: 'What your team found today' },
  '/app/guide': { title: 'Start Here', plain: 'How LegalMetrix works, in plain words' },
  '/app/scan': { title: 'New Scan', plain: 'Step 1: photograph a package' },
  '/app/review': { title: 'Review Queue', plain: 'Items waiting for a human decision' },
  '/app/products': { title: 'Products', plain: 'Every product your team has inspected' },
  '/app/ecommerce': { title: 'Online Listings', plain: 'Does the web listing match the physical pack?' },
  '/app/analytics': { title: 'Trends & Risk', plain: 'Where violations repeat — and what to inspect next' },
  '/app/reports': { title: 'Reports', plain: 'Official, evidence-backed compliance reports' },
  '/app/rules': { title: 'Rules Library', plain: 'The legal checklist the AI validates against' },
  '/app/rule-versions': { title: 'Rule Versions', plain: 'History of every published checklist' },
  '/app/admin': { title: 'Administration', plain: 'Users, logs and system setup' },
  '/app/admin/users': { title: 'Users', plain: 'Who can sign in and what they may do' },
  '/app/admin/audit-log': { title: 'Activity Log', plain: 'Permanent record of every action' },
  '/app/admin/settings': { title: 'Settings', plain: 'Thresholds, scoring weights and AI model connection' },
  '/app/profile': { title: 'My Profile', plain: 'Your official identity' },
};

function titleFor(pathname: string | null): { title: string; plain: string } {
  if (!pathname) return { title: 'Dashboard', plain: '' };
  if (pathname.startsWith('/app/scan/')) return { title: 'Inspection Result', plain: 'Step 2: check what the AI read, then decide' };
  if (pathname.startsWith('/app/products/')) return { title: 'Product', plain: 'History and risk for this product' };
  if (pathname.startsWith('/app/reports/')) return { title: 'Report', plain: 'This report is final once downloaded' };
  if (pathname.startsWith('/app/rules/')) return { title: 'Rule', plain: 'One requirement from the checklist' };
  const exact = TITLES[pathname.replace(/\/$/, '')];
  if (exact) return exact;
  return { title: 'LegalMetrix', plain: '' };
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; role?: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [openSearch, setOpenSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { title, plain } = titleFor(pathname);

  useEffect(() => {
    // The session is a real signed JWT set by the server — we ask for it once.
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.success) setUser(d.data); })
      .catch(() => {
        try { setUser(JSON.parse(localStorage.getItem('user') || 'null')); } catch {}
      });
    fetch('/api/analytics').then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.success) setPending(d.data?.kpis?.pendingReviews || 0); })
      .catch(() => {});

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setOnline(navigator.onLine);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, [pathname]);

  // Debounced search against /api/search (inspections, products, rules)
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => setResults(d?.success ? d.data.slice(0, 6) : []))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpenSearch(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (href: string) => { setOpenSearch(false); setQ(''); router.push(href); };

  return (
    <header className="h-[64px] border-b bg-white flex items-center justify-between px-6 gap-4 sticky top-0 z-40">
      <div className="min-w-0">
        <h1 className="font-semibold text-[15px] truncate">{title}</h1>
        <p className="text-xs text-muted-foreground truncate">{plain || 'Legal Metrology • Packaged Commodities Rules, 2011'}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className={`hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${online ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}
          title={online ? 'Connected to the server' : 'No connection — captures are queued on this device'}>
          {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {online ? 'Online' : 'Offline'}
        </div>

        <div className="relative hidden lg:block" ref={searchRef}>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search product, inspection, rule…"
            value={q}
            onChange={e => { setQ(e.target.value); setOpenSearch(true); }}
            onFocus={() => setOpenSearch(true)}
            onKeyDown={e => { if (e.key === 'Enter' && results[0]) go(results[0].href); if (e.key === 'Escape') setOpenSearch(false); }}
            className="pl-9 w-[280px] h-9 bg-muted/50"
            aria-label="Search"
          />
          {openSearch && q.trim().length >= 2 && (
            <div className="absolute top-full mt-1 w-[340px] bg-white border rounded-xl shadow-lg z-50 overflow-hidden">
              {results.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nothing matched “{q}”.</div>}
              {results.map((r: any) => (
                <button key={`${r.type}-${r.id}`} onClick={() => go(r.href)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent border-b last:border-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">{r.type}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{r.title}</span>
                    <span className="block text-xs text-muted-foreground truncate">{r.subtitle}</span>
                  </span>
                  <CornerDownLeft className="w-3 h-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>

        <Link href="/app/review" title={pending > 0 ? `${pending} items waiting for review` : 'Review queue'}>
          <Button variant="ghost" size="icon" className="h-9 w-9 relative">
            <Bell className="w-4 h-4" />
            {pending > 0 && <span className="absolute top-1.5 right-1.5 min-w-2 h-2 px-0.5 bg-red-500 rounded-full" />}
          </Button>
        </Link>

        <Link href="/app/profile" className="flex items-center gap-2 pl-3 border-l">
          <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-medium">
            {user?.name?.charAt(0) || '•'}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-medium leading-none">{user?.name || 'Signing in…'}</div>
            <div className="text-xs text-muted-foreground capitalize">{user?.role?.replace(/_/g, ' ') || ''}</div>
          </div>
        </Link>
      </div>
    </header>
  );
}
