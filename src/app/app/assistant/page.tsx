'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AssistantPanel } from '@/components/assistant/assistant-panel';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, statusVariant } from '@/lib/labels';
import { cn } from '@/utils/cn';
import type { Inspection } from '@/types';

/**
 * Compliance AI as its own destination.
 *
 * The panel answers only from stored records, and with no inspection selected it asks
 * which one to look at. This page gives that question somewhere to be answered: pick a
 * real inspection from the list, and the panel binds to it.
 */
export default function AssistantPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/inspections?limit=50', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (!active || !body.success) return;
        setInspections(body.data.inspections || []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask about an inspection. Answers come only from stored records, never from a
          model that might guess.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="border-0 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inspections</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="h-14 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : inspections.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No inspections to ask about yet"
                description="Complete an inspection and it will be available here."
              />
            ) : (
              <ul className="divide-y">
                <li>
                  <button
                    type="button"
                    onClick={() => setSelectedId('')}
                    className={cn(
                      'w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50',
                      selectedId === '' && 'bg-muted/60'
                    )}
                  >
                    <span className="font-medium">No inspection selected</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Ask a general question first
                    </span>
                  </button>
                </li>
                {inspections.map((inspection) => (
                  <li key={inspection.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(inspection.id)}
                      className={cn(
                        'w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50',
                        selectedId === inspection.id && 'bg-muted/60'
                      )}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium">{inspection.productName}</span>
                        <Badge variant={statusVariant(inspection.status)}>{inspection.status.replace(/_/g, ' ')}</Badge>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {inspection.inspectionNumber} · {formatDate(inspection.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Remounting on selection keeps each inspection's thread separate. */}
        <AssistantPanel key={selectedId || 'none'} inspectionId={selectedId || undefined} />
      </div>
    </div>
  );
}
