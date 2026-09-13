import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse, badRequest } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { hashPassword, publicUser } from '@/lib/auth/auth';
import { logAudit } from '@/lib/audit/audit';
import type { Role } from '@/types';

const ROLES: Role[] = ['SUPER_ADMIN', 'REGULATORY_ADMIN', 'ENFORCEMENT_OFFICER', 'REVIEWER', 'ANALYST', 'AUDITOR'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = requirePermission('user:write');
  if (isResponse(actor)) return actor;

  const existing = await db.users.get(params.id);
  if (!existing) {
    return NextResponse.json({ success: false, error: { message: 'User not found' } }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, any> = {};

  if (body.name !== undefined) patch.name = String(body.name);
  if (body.department !== undefined) patch.department = String(body.department);
  if (body.officialId !== undefined) patch.officialId = String(body.officialId);
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return badRequest('Unknown role.');
    patch.role = body.role;
  }
  if (body.password) {
    if (String(body.password).length < 8) return badRequest('Password must be at least 8 characters.');
    patch.passwordHash = await hashPassword(String(body.password));
  }

  if (Object.keys(patch).length === 0) return badRequest('Nothing to update.');
  if (existing.id === actor.id && patch.active === false) {
    return badRequest('You cannot deactivate your own account.');
  }

  const updated = await db.users.update(params.id, patch as any);

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    role: actor.role,
    action: 'USER_UPDATED',
    resource: 'USER',
    resourceId: params.id,
    newValue: Object.keys(patch).filter((k) => k !== 'passwordHash'),
  });

  return NextResponse.json({ success: true, data: publicUser(updated!) });
}
