'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Info, Loader2, Search, ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/client/api';
import { formatDate } from '@/lib/labels';
import type { EcommerceListing, Inspection } from '@/types';

export default function EcommercePage() {
  const [configured, setConfigured] = useState(false);
  const [listings, setListings] = useState<EcommerceListing[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  const [url, setUrl] = useState('');
  const [inspectionId, setInspectionId] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [statusBody, listingsBody, inspectionsBody] = await Promise.all([
          fetch('/api/ecommerce/analyze', { cache: 'no-store' }).then((res) => res.json()),
          fetch('/api/ecommerce/listings', { cache: 'no-store' }).then((res) => res.json()),
          fetch('/api/inspections?limit=100', { cache: 'no-store' }).then((res) => res.json()),
        ]);
        if (statusBody.success) setConfigured(Boolean(statusBody.data.configured));
        if (listingsBody.success) setListings(listingsBody.data.listings || []);
        if (inspectionsBody.success) setInspections(inspectionsBody.data.inspections || []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function analyze() {
    setAnalyzing(true);
    setError('');
    try {
      const res = await fetch('/api/ecommerce/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, inspectionId }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message || 'The listing could not be analyzed.');
        return;
      }
      setListings((current) => [body.data, ...current]);
      const refreshed = await fetch('/api/ecommerce/listings', { cache: 'no-store' }).then((r) => r.json());
      if (refreshed.success) setListings(refreshed.data.listings || []);
      setUrl('');
    } catch (analyzeError) {
      setError(errorMessage(analyzeError, 'The listing could not be analyzed.'));
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">E-commerce</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare an online listing against the declarations recorded during a physical inspection.
        </p>
      </div>

      {!configured && (
        <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">No listing provider is connected.</p>
            <p className="mt-1">
              Set ECOMMERCE_PROVIDER and ECOMMERCE_API_URL to connect a listing source. Until then the comparison
              cannot fetch listing data, and nothing is fabricated.
            </p>
          </div>
        </div>
      )}

      <Card className="border-0 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Analyze a listing
          </CardTitle>
          <CardDescription>Choose the inspection the listing should be compared against.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="listing-url">Listing URL</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="listing-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://…"
                className="flex-1"
              />
              <Button className="rounded-full" onClick={analyze} disabled={analyzing || !url || !inspectionId}>
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Analyze Listing
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="compare-inspection">Compare against inspection</Label>
            <select
              id="compare-inspection"
              value={inspectionId}
              onChange={(event) => setInspectionId(event.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">Select an inspection…</option>
              {inspections.map((inspection) => (
                <option key={inspection.id} value={inspection.id}>
                  {inspection.inspectionNumber} — {inspection.productName}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Analyzed listings</CardTitle>
        </CardHeader>
        <CardContent>
          {listings.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No e-commerce listings analyzed yet"
              description="Submit a listing URL above to compare it against a physical inspection."
            />
          ) : (
            <div className="space-y-3">
              {listings.map((listing) => (
                <div key={listing.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <a href={listing.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:underline">
                        {listing.url}
                      </a>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {listing.platform} · {listing.productName} · {formatDate(listing.extractedAt)}
                      </div>
                    </div>
                    <Badge variant={listing.complianceComparison?.some((c) => c.status === 'VIOLATION') ? 'violation' : 'compliant'} className="text-[10px]">
                      {listing.complianceComparison?.some((c) => c.status === 'VIOLATION') ? 'Mismatch' : 'Match'}
                    </Badge>
                  </div>

                  {listing.complianceComparison && (
                    <ul className="mt-3 space-y-1.5">
                      {listing.complianceComparison.map((row) => (
                        <li key={row.field} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">{row.field}</span>
                          <span>
                            Listing: <span className="font-medium">{row.listingValue || '—'}</span> · Package:{' '}
                            <span className="font-medium">{row.packageValue || '—'}</span>
                          </span>
                          <Badge variant={row.status === 'PASS' ? 'compliant' : row.status === 'VIOLATION' ? 'violation' : 'review'} className="text-[10px]">
                            {row.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Physical inspections are the source of truth.{' '}
        <Link href="/app/inspections" className="underline">
          View inspections
        </Link>
      </p>
    </div>
  );
}
