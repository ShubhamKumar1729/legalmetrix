import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { calculateRiskScore } from '@/lib/rules/scoring';

/**
 * Products are created automatically when an inspection is submitted.
 * This list is therefore always a reflection of real inspection activity.
 */
export async function GET(req: NextRequest) {
  const user = requirePermission('product:read');
  if (isResponse(user)) return user;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').toLowerCase().trim();
  const category = searchParams.get('category');

  const [products, inspections] = await Promise.all([
    db.products.list({}, { sortDescBy: 'updatedAt' }),
    db.inspections.list({}, { sortDescBy: 'createdAt' }),
  ]);

  const enriched = products.map((product) => {
    const history = inspections.filter(
      (i) => i.productId === product.id || i.productName === product.name
    );
    const analyzed = history.filter((i) => i.status !== 'DRAFT' && i.status !== 'PROCESSING');
    return {
      ...product,
      inspectionCount: history.length,
      violationCount: analyzed.filter((i) => i.status === 'NON_COMPLIANT').length,
      latestScore: analyzed[0]?.scored ? analyzed[0].complianceScore : null,
      riskScore: calculateRiskScore(analyzed),
      lastInspection: history[0]?.createdAt || product.updatedAt,
    };
  });

  const filtered = enriched.filter((product) => {
    const matchesQuery =
      !q || `${product.name} ${product.brand} ${product.manufacturer} ${product.barcode}`.toLowerCase().includes(q);
    const matchesCategory = !category || category === 'ALL' || product.category === category;
    return matchesQuery && matchesCategory;
  });

  return NextResponse.json({ success: true, data: { products: filtered, total: filtered.length } });
}
