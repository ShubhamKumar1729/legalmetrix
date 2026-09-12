'use client';

import { cn } from '@/utils/cn';
import { Check } from 'lucide-react';

/**
 * "Step 2 of 4" tracker with a plain-language caption under each step,
 * shared by the scan wizard and the inspection results screen so the
 * workflow always reads as one continuous path.
 */
export function StepBar({
  steps,
  current,
  onStepClick,
}: {
  steps: { n: number; label: string; hint?: string }[];
  current: number;
  onStepClick?: (n: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-start gap-2">
      {steps.map((s, idx) => {
        const done = current > s.n;
        const active = current === s.n;
        const clickable = !!onStepClick && s.n < current;
        return (
          <li key={s.n} className="flex items-start gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(s.n)}
              className={cn(
                'flex items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors',
                clickable && 'hover:bg-stone-100 cursor-pointer',
                !clickable && 'cursor-default'
              )}
            >
              <span
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
                  done && 'bg-emerald-600 text-white',
                  active && 'bg-stone-900 text-white ring-4 ring-stone-900/10',
                  !done && !active && 'bg-stone-200 text-stone-500'
                )}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : s.n}
              </span>
              <span>
                <span className={cn('block text-sm leading-4', active ? 'font-semibold' : done ? 'font-medium text-foreground/80' : 'text-muted-foreground')}>
                  {s.label}
                </span>
                {s.hint && <span className="block text-[11px] text-muted-foreground leading-4 mt-0.5 max-w-[150px]">{s.hint}</span>}
              </span>
            </button>
            {idx < steps.length - 1 && <span className={cn('w-6 h-0.5 mt-4 rounded', done ? 'bg-emerald-500' : 'bg-stone-200')} />}
          </li>
        );
      })}
    </ol>
  );
}
