'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, Menu, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSession } from '@/components/session-provider';

const TITLES: { match: string; title: string }[] = [
  { match: '/app/dashboard', title: 'Dashboard' },
  { match: '/app/inspections/new', title: 'New Inspection' },
  { match: '/app/inspections', title: 'Inspections' },
  { match: '/app/review', title: 'Review' },
  { match: '/app/products', title: 'Products' },
  { match: '/app/reports', title: 'Reports' },
  { match: '/app/ecommerce', title: 'E-commerce' },
  { match: '/app/rules', title: 'Rules' },
  { match: '/app/admin', title: 'Admin' },
  { match: '/app/profile', title: 'Profile' },
];

function titleFor(pathname: string | null): string {
  if (!pathname) return 'Dashboard';
  const exact = TITLES.find((entry) => entry.match === pathname);
  if (exact) return exact.title;
  const partial = TITLES.filter((entry) => pathname.startsWith(entry.match)).sort(
    (a, b) => b.match.length - a.match.length
  )[0];
  return partial?.title || 'LegalMetrix';
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  description: string;
  href: string;
  createdAt: string;
}

export function TopNav({ onOpenNav }: { onOpenNav: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSession();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; type: string; title: string; subtitle: string; href: string }[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch('/api/notifications', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => body.success && setNotifications(body.data.items || []))
      .catch(() => undefined);
  }, [session, pathname]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((body) => body.success && setResults(body.data || []))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const initials = (session?.user.name || '')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-16 items-center justify-between gap-3 border-b bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenNav}
          className="rounded-lg p-2 hover:bg-accent md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-[15px] font-semibold">{titleFor(pathname)}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search inspections, products, rules…"
            className="h-9 w-[260px] bg-muted/50 pl-9"
          />
          {results.length > 0 && (
            <div className="absolute right-0 top-11 z-30 w-[320px] overflow-hidden rounded-xl border bg-white shadow-lg">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-accent"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    router.push(result.href);
                  }}
                >
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{result.type}</span>
                  <span className="text-sm font-medium">{result.title}</span>
                  <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setShowNotifications((open) => !open)}
            className="relative rounded-lg p-2 hover:bg-accent"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notifications.length > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-11 z-30 w-[320px] overflow-hidden rounded-xl border bg-white shadow-lg">
              <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notifications
              </div>
              {notifications.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No new notifications.</p>
              ) : (
                <ul className="max-h-80 overflow-y-auto">
                  {notifications.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-accent"
                        onClick={() => {
                          setShowNotifications(false);
                          router.push(item.href);
                        }}
                      >
                        <span className="text-sm font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{item.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-l pl-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">
            {initials || '—'}
          </div>
          <div className="hidden text-left md:block">
            <div className="text-sm font-medium leading-none">{session?.user.name || '—'}</div>
            <div className="text-xs text-muted-foreground">{session?.simpleRoleLabel || ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
