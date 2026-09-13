import { NextResponse } from 'next/server';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';

/**
 * Every number here is computed from stored inspection records.
 * Nothing is randomised, extrapolated or filled in — an empty database yields zeros.
 */
export async function GET() {
  const user = requirePermission('analytics:read');
  if (isResponse(user)) return user;

  const [inspections, products, reports, rules] = await Promise.all([
    db.inspections.list({}, { sortDescBy: 'createdAt' }),
    db.products.list(),
    db.reports.list(),
    db.rules.list(),
  ]);

  const scored = inspections.filter((i) => i.scored);
  const total = inspections.length;
  const compliant = inspections.filter((i) => i.status === 'COMPLIANT').length;
  const violations = inspections.filter((i) => i.status === 'NON_COMPLIANT').length;
  const reviewRequired = inspections.filter((i) => i.status === 'REVIEW_REQUIRED').length;
  const pendingFindings = inspections.flatMap((i) => i.findings).filter((f) => f.reviewStatus === 'PENDING').length;

  const complianceRate = scored.length > 0 ? Math.round((compliant / scored.length) * 100) : 0;
  const avgConfidence =
    scored.length > 0
      ? Math.round(scored.reduce((sum, i) => sum + (i.confidenceSummary?.average || 0), 0) / scored.length)
      : 0;

  const violationCategories = inspections
    .flatMap((i) => i.findings)
    .filter((f) => f.status === 'VIOLATION')
    .reduce<Record<string, number>>((acc, f) => {
      acc[f.title || f.declarationType] = (acc[f.title || f.declarationType] || 0) + 1;
      return acc;
    }, {});

  const categoryDistribution = inspections.reduce<Record<string, number>>((acc, i) => {
    acc[i.category || 'OTHER'] = (acc[i.category || 'OTHER'] || 0) + 1;
    return acc;
  }, {});

  // Real activity per day for the last 14 days. Days without activity stay at zero.
  const days: { date: string; inspections: number; compliant: number; violations: number }[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - offset);
    const date = day.toISOString().slice(0, 10);
    const dayInspections = inspections.filter((i) => (i.createdAt || '').slice(0, 10) === date);
    days.push({
      date,
      inspections: dayInspections.length,
      compliant: dayInspections.filter((i) => i.status === 'COMPLIANT').length,
      violations: dayInspections.filter((i) => i.status === 'NON_COMPLIANT').length,
    });
  }

  const manufacturers = Object.values(
    inspections.reduce<Record<string, { manufacturer: string; inspections: number; violations: number; lastInspection: string }>>(
      (acc, i) => {
        const key = i.manufacturer || 'Unknown';
        if (!acc[key]) acc[key] = { manufacturer: key, inspections: 0, violations: 0, lastInspection: i.createdAt };
        acc[key].inspections += 1;
        if (i.status === 'NON_COMPLIANT') acc[key].violations += 1;
        if (i.createdAt > acc[key].lastInspection) acc[key].lastInspection = i.createdAt;
        return acc;
      },
      {}
    )
  )
    .map((m) => ({
      ...m,
      violationRate: Math.round((m.violations / m.inspections) * 100),
    }))
    .sort((a, b) => b.violations - a.violations || b.inspections - a.inspections);

  return NextResponse.json({
    success: true,
    data: {
      kpis: {
        totalInspections: total,
        compliant,
        violations,
        reviewRequired,
        complianceRate,
        avgConfidence,
        pendingReviews: pendingFindings,
        products: products.length,
        reports: reports.length,
        rulesPublished: rules.filter((r) => r.enabled && r.status === 'PUBLISHED').length,
      },
      hasData: total > 0,
      overTime: days,
      violationCategories: Object.entries(violationCategories).map(([name, value]) => ({ name, value })),
      categoryDistribution: Object.entries(categoryDistribution).map(([name, value]) => ({ name, value })),
      manufacturers,
    },
  });
}
