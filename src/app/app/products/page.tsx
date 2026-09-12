'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/explainer';
import { Search, Package, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

function ProductsInner() {
  const [products, setProducts] = useState<any[]>([]);
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const [category, setCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => { if (d.success) setProducts(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter(p => {
    const s = search.toLowerCase();
    const matchSearch = !s || p.name.toLowerCase().includes(s) || (p.brand || '').toLowerCase().includes(s) || (p.manufacturer || '').toLowerCase().includes(s);
    const matchCat = category === 'ALL' || p.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Products" inPlainWords="Every product your team has inspected, with its track record. High risk = inspected often, violates often." />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, brand or maker…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" aria-label="Filter by category">
          <option value="ALL">All categories</option>
          <option value="FOOD">Food</option>
          <option value="GROCERY">Grocery</option>
          <option value="COSMETICS">Cosmetics</option>
          <option value="ELECTRONICS">Electronics</option>
          <option value="TEXTILES">Textiles</option>
        </select>
        <Badge variant="outline" className="px-3 py-1.5">{filtered.length} of {products.length}</Badge>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <p className="text-sm text-muted-foreground">Loading products…</p>}
        {filtered.map((p: any) => (
          <Card key={p.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 rounded-xl bg-stone-900 text-white flex items-center justify-center"><Package className="w-6 h-6" /></div>
                <Badge
                  variant={p.riskScore > 70 ? 'violation' : p.riskScore > 40 ? 'review' : 'compliant'}
                  className="text-[10px]"
                  title="0–100. How likely this maker is to violate again: repeated problems raise the score.">
                  Risk {p.riskScore}
                </Badge>
              </div>
              <div className="mt-4">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-muted-foreground">{p.brand} • {p.manufacturer}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.category} • {p.inspections} inspection{p.inspections === 1 ? '' : 's'} • {p.violations} with problems</div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={`/app/products/${p.id}`} className="flex-1"><Button size="sm" className="w-full rounded-full">Open</Button></Link>
                <Link href={`/app/products/${p.id}/history`} className="flex-1"><Button size="sm" variant="outline" className="w-full rounded-full">History</Button></Link>
              </div>
              {p.riskScore > 70 && (
                <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Prioritize for the next field visit
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!loading && filtered.length === 0 && (
          <Card className="border-dashed shadow-none md:col-span-2 lg:col-span-3"><CardContent className="p-10 text-center text-muted-foreground">
            No products match. <Link href="/app/scan" className="text-emerald-700 font-medium underline">Start a scan</Link> to add one.
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}><ProductsInner /></Suspense>;
}
