import { NextRequest, NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await seedMemoryDB();
  const product = await memoryDB.products.findById(params.id);
  if (!product) {
    // Try by name
    const all = memoryDB.products.all();
    const byName = all.find((p: any) => p.name.toLowerCase().includes(params.id.toLowerCase()));
    if (byName) {
      const inspections = memoryDB.inspections.all().filter((i: any) => i.productId === byName.id || i.productName === byName.name);
      return NextResponse.json({ success: true, data: { product: byName, inspections } });
    }
    return NextResponse.json({ success: false, error: { message: 'Not found' } }, { status: 404 });
  }

  const inspections = memoryDB.inspections.all().filter((i: any) => i.productId === product.id || i.productName === (product as any).name);

  return NextResponse.json({ success: true, data: { product, inspections } });
}
