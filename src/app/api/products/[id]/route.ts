import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { calculateRiskScore } from '@/lib/rules/scoring';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = requirePermission('product:read');
  if (isResponse(user)) return user;

  const product = await db.products.get(params.id);
  if (!product) {
    return NextResponse.json({ success: false, error: { message: 'Product not found' } }, { status: 404 });
  }

  const inspections = (await db.inspections.list({}, { sortDescBy: 'createdAt' })).filter(
    (i) => i.productId === product.id || i.productName === product.name
  );
  const analyzed = inspections.filter((i) => i.status !== 'DRAFT' && i.status !== 'PROCESSING');

  return NextResponse.json({
    success: true,
    data: {
      product: {
        ...product,
        inspectionCount: inspections.length,
        violationCount: analyzed.filter((i) => i.status === 'NON_COMPLIANT').length,
        riskScore: calculateRiskScore(analyzed),
      },
      history: inspections,
      trend: analyzed.map((i) => ({
        date: i.createdAt,
        score: i.scored ? i.complianceScore : null,
        status: i.status,
        inspectionNumber: i.inspectionNumber,
      })),
    },
  });
}
