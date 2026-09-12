import { NextRequest, NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';

export async function GET(req: NextRequest) {
  await seedMemoryDB();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const category = searchParams.get('category');

  let products = memoryDB.products.all();

  if (search) {
    const s = search.toLowerCase();
    products = products.filter((p: any) => 
      p.name.toLowerCase().includes(s) ||
      p.brand.toLowerCase().includes(s) ||
      p.manufacturer.toLowerCase().includes(s)
    );
  }

  if (category) {
    products = products.filter((p: any) => p.category === category);
  }

  // Enrich with inspection counts
  const inspections = memoryDB.inspections.all();
  const enriched = products.map((p: any) => {
    const productInspections = inspections.filter((i: any) => i.productId === p.id || i.productName === p.name);
    const violations = productInspections.filter((i: any) => i.status === 'NON_COMPLIANT').length;
    return {
      ...p,
      inspections: productInspections.length,
      violations,
      lastInspection: productInspections[0]?.createdAt || p.lastInspection,
    };
  });

  return NextResponse.json({ success: true, data: enriched });
}
