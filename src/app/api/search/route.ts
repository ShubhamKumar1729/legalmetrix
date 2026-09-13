import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { hasPermission } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  const user = requirePermission('inspection:read');
  if (isResponse(user)) return user;

  const q = (new URL(req.url).searchParams.get('q') || '').toLowerCase().trim();
  if (q.length < 2) return NextResponse.json({ success: true, data: [] });

  const [inspections, products, rules] = await Promise.all([
    db.inspections.list({}, { sortDescBy: 'createdAt', limit: 50 }),
    db.products.list({}, { limit: 50 }),
    hasPermission(user.role, 'rule:read') ? db.rules.list() : Promise.resolve([]),
  ]);

  const results = [
    ...inspections
      .filter((i) => `${i.productName} ${i.brand} ${i.inspectionNumber} ${i.manufacturer}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map((i) => ({
        type: 'Inspection',
        id: i.id,
        title: i.inspectionNumber,
        subtitle: i.productName,
        href: `/app/inspections/${i.id}`,
      })),
    ...products
      .filter((p) => `${p.name} ${p.brand} ${p.manufacturer}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map((p) => ({ type: 'Product', id: p.id, title: p.name, subtitle: p.brand, href: `/app/products/${p.id}` })),
    ...rules
      .filter((r) => `${r.ruleCode} ${r.title}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map((r) => ({ type: 'Rule', id: r.id, title: r.ruleCode, subtitle: r.title, href: `/app/rules/${r.id}` })),
  ];

  return NextResponse.json({ success: true, data: results });
}
