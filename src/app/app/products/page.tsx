"use client";
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Package, AlertTriangle, TrendingUp, Eye } from 'lucide-react';
import Link from 'next/link';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
  }, []);

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold tracking-tight">Product Repository</h1><p className="text-sm text-muted-foreground">Searchable history • Risk scoring • Compliance trend</p></div>
        <div className="flex gap-2">
          <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search product, brand, barcode..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-[280px]" /></div>
          <Button variant="outline" className="rounded-full">Filter</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p: any) => (
          <Card key={p.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Package className="w-6 h-6" /></div>
                <Badge variant={p.riskScore > 70 ? 'violation' : p.riskScore > 40 ? 'review' : 'compliant'} className="text-[10px]">Risk {p.riskScore}</Badge>
              </div>
              <div className="mt-4">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-muted-foreground">{p.brand} • {p.manufacturer}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.category} • {p.inspections} inspections • {p.violations} violations</div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={`/app/products/${p.id}`} className="flex-1"><Button size="sm" className="w-full rounded-full"><Eye className="w-3 h-3 mr-1" />View</Button></Link>
                <Link href={`/app/products/${p.id}/history`} className="flex-1"><Button size="sm" variant="outline" className="w-full rounded-full">History</Button></Link>
              </div>
              {p.riskScore > 70 && <div className="mt-3 text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Repeat offender • Enforcement prioritized</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
