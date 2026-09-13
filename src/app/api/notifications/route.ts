import { NextResponse } from 'next/server';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { hasPermission } from '@/lib/auth/rbac';

/**
 * Notifications are derived from real records — a finding awaiting review, or a report
 * generated for an inspection. An empty database produces an empty list.
 */
export async function GET() {
  const user = requirePermission('inspection:read');
  if (isResponse(user)) return user;

  const inspections = await db.inspections.list({}, { sortDescBy: 'createdAt', limit: 100 });
  const canReview = hasPermission(user.role, 'review:read');

  const items: { id: string; type: string; title: string; description: string; href: string; createdAt: string }[] = [];

  if (canReview) {
    for (const inspection of inspections) {
      const pending = inspection.findings.filter((f) => f.reviewStatus === 'PENDING');
      if (pending.length === 0) continue;
      items.push({
        id: `review-${inspection.id}`,
        type: 'REVIEW',
        title: `${pending.length} finding${pending.length === 1 ? '' : 's'} need review`,
        description: `${inspection.productName} • ${inspection.inspectionNumber}`,
        href: `/app/inspections/${inspection.id}`,
        createdAt: inspection.updatedAt || inspection.createdAt,
      });
    }
  }

  for (const inspection of inspections) {
    if (!inspection.reportId) continue;
    items.push({
      id: `report-${inspection.id}`,
      type: 'REPORT',
      title: 'Report available',
      description: `${inspection.productName} • ${inspection.inspectionNumber}`,
      href: `/app/reports`,
      createdAt: inspection.updatedAt || inspection.createdAt,
    });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    success: true,
    data: { items: items.slice(0, 20), unread: items.length },
  });
}
