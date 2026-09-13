import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse, badRequest } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { logAudit } from '@/lib/audit/audit';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = requirePermission('inspection:read');
  if (isResponse(user)) return user;

  const inspection =
    (await db.inspections.get(params.id)) ||
    (await db.inspections.findOne({ inspectionNumber: params.id }));

  if (!inspection) {
    return NextResponse.json({ success: false, error: { message: 'Inspection not found' } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: inspection });
}

const EDITABLE_FIELDS = ['reviewStatus', 'location', 'batchNumber', 'barcode'] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requirePermission('inspection:update');
  if (isResponse(user)) return user;

  const inspection = await db.inspections.get(params.id);
  if (!inspection) {
    return NextResponse.json({ success: false, error: { message: 'Inspection not found' } }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) patch[field] = body[field];
  }
  if (Object.keys(patch).length === 0) {
    return badRequest('No editable fields were provided.');
  }

  const updated = await db.inspections.update(inspection.id, {
    ...patch,
    updatedAt: new Date().toISOString(),
  } as any);

  await logAudit({
    userId: user.id,
    userName: user.name,
    role: user.role,
    action: 'INSPECTION_UPDATED',
    resource: 'INSPECTION',
    resourceId: inspection.id,
    oldValue: Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, (inspection as any)[f]])),
    newValue: patch,
  });

  return NextResponse.json({ success: true, data: updated });
}
