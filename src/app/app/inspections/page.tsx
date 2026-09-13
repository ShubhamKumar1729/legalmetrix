'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, PlusCircle, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { formatDate, STATUS_LABEL, statusVariant } from '@/lib/labels';
import type { Inspection } from '@/types';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'COMPLIANT', label: 'Compliant' },
  { id: 'NON_COMPLIANT', label: 'Violations' },
  { id: 'REVIEW_REQUIRED', label: 'Review required' },
  { id: 'DRAFT', label: 'Not analyzed' },
];

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/inspections?limit=200', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => body.success && setInspections(body.data.inspections || []))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return inspections.filter((inspection) => {
      const matchesFilter = filter === 'ALL' || inspection.status === filter;
      const matchesQuery =
        !term ||
        `${inspection.inspectionNumber} ${inspection.productName} ${inspection.brand} ${inspection.manufacturer}`
          .toLowerCase()
          .includes(term);
      return matchesFilter && matchesQuery;
    });
  }, [inspections, filter, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inspections</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every inspection created in this system, newest first.
          </p>
        </div>
        <Link href="/app/inspections/new">
          <Button className="rounded-full">
            <PlusCircle className="h-4 w-4" /> New Inspection
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => (
          <Button
            key={option.id}
            size="sm"
            variant={filter === option.id ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </Button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            className="h-9 w-full pl-9 sm:w-[240px]"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={inspections.length === 0 ? 'No inspections yet' : 'No inspections match this filter'}
          description={
            inspections.length === 0
              ? 'Start an inspection to capture package images and check the mandatory declarations.'
              : 'Try a different status or search term.'
          }
          action={
            inspections.length === 0 ? (
              <Link href="/app/inspections/new">
                <Button className="rounded-full">
                  <PlusCircle className="h-4 w-4" /> Start Inspection
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="border-0 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left font-medium">Inspection</th>
                    <th className="p-3 text-left font-medium">Product</th>
                    <th className="hidden p-3 text-left font-medium md:table-cell">Manufacturer</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-right font-medium">Score</th>
                    <th className="hidden p-3 text-right font-medium sm:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((inspection) => (
                    <tr key={inspection.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3">
                        <Link href={`/app/inspections/${inspection.id}`} className="font-medium hover:underline">
                          {inspection.inspectionNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground">{inspection.images?.length || 0} images</div>
                      </td>
                      <td className="p-3">
                        {inspection.productName}
                        <div className="text-xs text-muted-foreground">{inspection.brand}</div>
                      </td>
                      <td className="hidden p-3 text-muted-foreground md:table-cell">{inspection.manufacturer}</td>
                      <td className="p-3">
                        <Badge variant={statusVariant(inspection.status)} className="text-[10px]">
                          {STATUS_LABEL[inspection.status] || inspection.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-medium">
                        {inspection.scored ? `${inspection.complianceScore}/100` : '—'}
                      </td>
                      <td className="hidden p-3 text-right text-muted-foreground sm:table-cell">
                        {formatDate(inspection.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
