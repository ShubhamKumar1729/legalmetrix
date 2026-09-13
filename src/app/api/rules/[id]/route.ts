import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse, badRequest } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { logAudit } from '@/lib/audit/audit';
import { ruleInputSchema } from '@/lib/rules/validation';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = requirePermission('rule:read');
  if (isResponse(user)) return user;

  const rule = await db.rules.get(params.id);
  if (!rule) {
    return NextResponse.json({ success: false, error: { message: 'Rule not found' } }, { status: 404 });
  }

  const versions = (await db.rules.list({ ruleCode: rule.ruleCode })).sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true })
  );

  return NextResponse.json({ success: true, data: { rule, versions } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requirePermission('rule:write');
  if (isResponse(user)) return user;

  const existing = await db.rules.get(params.id);
  if (!existing) {
    return NextResponse.json({ success: false, error: { message: 'Rule not found' } }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const patch = ruleInputSchema.partial().safeParse(body);
  if (!patch.success) {
    return badRequest(patch.error.issues.map((i) => i.message).join(' '));
  }

  const nextStatus = patch.data.status ?? existing.status;
  if (nextStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
    const publisher = requirePermission('rule:publish');
    if (isResponse(publisher)) return publisher;
  }

  const updated = await db.rules.update(params.id, {
    ...patch.data,
    updatedBy: user.id,
    updatedAt: new Date().toISOString(),
  } as any);

  await logAudit({
    userId: user.id,
    userName: user.name,
    role: user.role,
    action: nextStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED' ? 'RULE_PUBLISHED' : 'RULE_UPDATED',
    resource: 'RULE',
    resourceId: params.id,
    oldValue: { status: existing.status, enabled: existing.enabled, version: existing.version },
    newValue: { status: nextStatus, enabled: updated?.enabled, version: updated?.version },
  });

  return NextResponse.json({ success: true, data: updated });
}
