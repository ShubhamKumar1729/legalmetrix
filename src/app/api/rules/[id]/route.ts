import { NextRequest, NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';
import { logAudit } from '@/lib/audit/audit';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await seedMemoryDB();
  const rule = await memoryDB.rules.findById(params.id);
  if (!rule) return NextResponse.json({ success: false, error: { message: 'Not found' } }, { status: 404 });
  return NextResponse.json({ success: true, data: rule });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await seedMemoryDB();
  const body = await req.json();
  const existing = await memoryDB.rules.findById(params.id);
  if (!existing) return NextResponse.json({ success: false, error: { message: 'Not found' } }, { status: 404 });

  const updated = await memoryDB.rules.update(params.id, {
    ...body,
    updatedAt: new Date().toISOString(),
    updatedBy: body.updatedBy || existing.updatedBy,
  });

  await logAudit({
    userId: (updated as any).updatedBy,
    userName: 'Admin',
    role: 'REGULATORY_ADMIN',
    action: 'RULE_UPDATED',
    resource: 'RULE',
    resourceId: params.id,
    oldValue: existing,
    newValue: updated,
  });

  return NextResponse.json({ success: true, data: updated });
}
