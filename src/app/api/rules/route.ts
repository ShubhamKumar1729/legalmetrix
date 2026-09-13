import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse, badRequest } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { logAudit } from '@/lib/audit/audit';
import { ruleInputSchema } from '@/lib/rules/validation';
import type { RegulatoryRule } from '@/types';

export async function GET() {
  const user = requirePermission('rule:read');
  if (isResponse(user)) return user;

  const rules = await db.rules.list();
  const sorted = rules.sort((a, b) => a.ruleCode.localeCompare(b.ruleCode) || b.version.localeCompare(a.version));
  return NextResponse.json({ success: true, data: { rules: sorted, total: sorted.length } });
}

export async function POST(req: NextRequest) {
  const user = requirePermission('rule:write');
  if (isResponse(user)) return user;

  const body = await req.json().catch(() => ({}));
  const parsed = ruleInputSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(' '));
  }

  // Publishing a rule is a separate authority from authoring one.
  if (parsed.data.status === 'PUBLISHED') {
    const publisher = requirePermission('rule:publish');
    if (isResponse(publisher)) return publisher;
  }

  const duplicate = await db.rules.findOne({ ruleCode: parsed.data.ruleCode, version: parsed.data.version });
  if (duplicate) {
    return badRequest(`Rule ${parsed.data.ruleCode} v${parsed.data.version} already exists.`);
  }

  const now = new Date().toISOString();
  const rule = await db.rules.create({
    ...parsed.data,
    createdBy: user.id,
    updatedBy: user.id,
    createdAt: now,
    updatedAt: now,
  } as Omit<RegulatoryRule, 'id'>);

  await logAudit({
    userId: user.id,
    userName: user.name,
    role: user.role,
    action: 'RULE_CREATED',
    resource: 'RULE',
    resourceId: rule.id,
    newValue: { ruleCode: rule.ruleCode, version: rule.version, status: rule.status },
  });

  return NextResponse.json({ success: true, data: rule }, { status: 201 });
}
