'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Package, PlusCircle, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { CATEGORY_LABEL, formatDate } from '@/lib/labels';

interface ProductRow {
  id: string;
  name: string;
  brand: string;
  manufacturer: string;
  category: string;
  barcode?: string;
  inspectionCount: number;
  violationCount: number;
  latestScore: number | null;
  riskScore: number;
  lastInspection?: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/products', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => body.success && setProducts(body.data.products || []))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      `${product.name} ${product.brand} ${product.manufacturer} ${product.barcode}`.toLowerCase().includes(term)
    );
  }, [products, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Products are created automatically the first time they are inspected.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products…"
            className="h-9 w-full pl-9 sm:w-[260px]"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products inspected yet"
          description="Start an inspection to automatically create your first product record."
          action={
            <Link href="/app/inspections/new">
              <Button className="rounded-full">
                <PlusCircle className="h-4 w-4" /> Start Inspection
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((product) => (
            <Card key={product.id} className="border-0 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Package className="h-5 w-5" />
                  </div>
                  <Badge
                    variant={product.riskScore > 60 ? 'violation' : product.riskScore > 25 ? 'review' : 'compliant'}
                    className="text-[10px]"
                  >
                    Risk {product.riskScore}
                  </Badge>
                </div>

                <div className="mt-4">
                  <div className="font-semibold">{product.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {product.brand || 'No brand'} · {product.manufacturer}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {CATEGORY_LABEL[product.category] || product.category} · {product.inspectionCount} inspection
                    {product.inspectionCount === 1 ? '' : 's'} · {product.violationCount} violation
                    {product.violationCount === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>Latest score: {product.latestScore === null ? '—' : `${product.latestScore}/100`}</span>
                  <span>{formatDate(product.lastInspection)}</span>
                </div>

                <Link href={`/app/products/${product.id}`} className="mt-4 block">
                  <Button size="sm" variant="outline" className="w-full rounded-full">
                    View product history
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
