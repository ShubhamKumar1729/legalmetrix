import { NextRequest, NextResponse } from 'next/server';
import { guardRequest } from '@/lib/auth/session';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = guardRequest(req, 'inspection:read'); if (denied) return denied;
  await seedMemoryDB();
  const id = params.id;

  // Search by id or inspectionId
  let inspection = await memoryDB.inspections.findById(id);
  if (!inspection) {
    const all = memoryDB.inspections.all();
    inspection = all.find(i => i.inspectionId === id) || null;
  }

  if (!inspection) {
    return NextResponse.json({ success: false, error: { message: 'Inspection not found' } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: inspection });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = guardRequest(req, 'inspection:update'); if (denied) return denied;
  await seedMemoryDB();
  const id = params.id;
  const body = await req.json();

  let inspection = await memoryDB.inspections.findById(id);
  if (!inspection) {
    const all = memoryDB.inspections.all();
    inspection = all.find(i => i.inspectionId === id) || null;
  }

  if (!inspection) {
    return NextResponse.json({ success: false, error: { message: 'Not found' } }, { status: 404 });
  }

  const updated = await memoryDB.inspections.update(inspection.id, {
    ...body,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, data: updated });
}
