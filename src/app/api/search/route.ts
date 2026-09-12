import { NextRequest, NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';

export async function GET(req: NextRequest) {
  await seedMemoryDB();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.toLowerCase() || '';

  if (!q) return NextResponse.json({ success: true, data: [] });

  const inspections = memoryDB.inspections.all().filter(i => 
    i.productName.toLowerCase().includes(q) ||
    i.inspectionId.toLowerCase().includes(q) ||
    i.brand.toLowerCase().includes(q)
  ).slice(0, 5);

  const products = memoryDB.products.all().filter((p: any) => 
    p.name.toLowerCase().includes(q) ||
    p.brand.toLowerCase().includes(q)
  ).slice(0, 5);

  const rules = memoryDB.rules.all().filter(r => 
    r.ruleCode.toLowerCase().includes(q) ||
    r.title.toLowerCase().includes(q)
  ).slice(0, 5);

  const results = [
    ...inspections.map(i => ({ type: 'Inspection', id: i.id, title: i.inspectionId, subtitle: i.productName, href: `/app/scan/${i.id}` })),
    ...products.map((p: any) => ({ type: 'Product', id: p.id, title: p.name, subtitle: p.brand, href: `/app/products/${p.id}` })),
    ...rules.map(r => ({ type: 'Rule', id: r.id, title: r.ruleCode, subtitle: r.title, href: `/app/rules/${r.id}` })),
  ];

  return NextResponse.json({ success: true, data: results });
}
