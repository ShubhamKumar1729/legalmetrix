'use client';

import { useState, type ReactNode } from 'react';
import { Lightbulb, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Page title + one plain sentence on what to do here.
 * Every screen uses this so a new user is never guessing.
 */
export function PageHeader({
  title,
  inPlainWords,
  children,
}: {
  title: string;
  inPlainWords: string;
  children?: ReactNode; // actions (buttons)
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{inPlainWords}</p>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/**
 * A collapsible "explain like I'm new" box. Open by default on the first
 * screens a new user sees; closed elsewhere.
 */
export function Explainer({
  title = 'How this works',
  children,
  defaultOpen = false,
  className,
}: {
  title?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('rounded-xl border bg-stone-50 overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-stone-100/70 transition-colors"
        aria-expanded={open}
      >
        <Lightbulb className="w-4 h-4 text-emerald-700 flex-shrink-0" />
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>}
    </div>
  );
}

/**
 * Small colored note strip used across pages (replaces the old blue tip boxes).
 */
export function Notice({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
    bad: 'bg-red-50 border-red-200 text-red-900',
    neutral: 'bg-stone-100 border-stone-200 text-stone-800',
  } as const;
  return (
    <div className={cn('rounded-xl border p-3.5 text-sm flex gap-3 items-start', tones[tone], className)}>
      {icon && <span className="mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="leading-relaxed min-w-0">{children}</div>
    </div>
  );
}
