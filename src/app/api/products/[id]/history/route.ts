import { NextRequest, NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await seedMemoryDB();
  const product = await memoryDB.products.findById(params.id);
  if (!product) return NextResponse.json({ success: false, error: { message: 'Not found' } }, { status: 404 });

  const history = memoryDB.inspections.all()
    .filter((i: any) => i.productId === params.id || i.productName === (product as any).name)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Generate trend data
  const trend = history.map((h: any) => ({
    date: h.createdAt,
    score: h.complianceScore,
    status: h.status,
    inspectionId: h.inspectionId,
  }));

  return NextResponse.json({ success: true, data: { history, trend } });
}
