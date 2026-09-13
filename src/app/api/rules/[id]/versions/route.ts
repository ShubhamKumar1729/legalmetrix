import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse, badRequest } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { logAudit } from '@/lib/audit/audit';

function bumpVersion(version: string): string {
  const parts = (version || '1.0').split('.').map((n) => parseInt(n, 10) || 0);
  parts[parts.length - 1] += 1;
  return parts.join('.');
}

/**
 * Creates a new draft version of an existing rule.
 * The published version keeps applying until the new one is published.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requirePermission('rule:write');
  if (isResponse(user)) return user;

  const source = await db.rules.get(params.id);
  if (!source) {
    return NextResponse.json({ success: false, error: { message: 'Rule not found' } }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const versions = await db.rules.list({ ruleCode: source.ruleCode });
  const latest = versions.reduce((max, r) =>
    r.version.localeCompare(max.version, undefined, { numeric: true }) > 0 ? r : max
  );
  const nextVersion = String(body.version || bumpVersion(latest.version));

  if (versions.some((r) => r.version === nextVersion)) {
    return badRequest(`Version ${nextVersion} of ${source.ruleCode} already exists.`);
  }

  const now = new Date().toISOString();
  const draft = await db.rules.create({
    ...source,
    id: undefined as any,
    version: nextVersion,
    status: 'DRAFT',
    createdBy: user.id,
    updatedBy: user.id,
    createdAt: now,
    updatedAt: now,
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    role: user.role,
    action: 'RULE_VERSION_CREATED',
    resource: 'RULE',
    resourceId: draft.id,
    newValue: { ruleCode: source.ruleCode, fromVersion: source.version, toVersion: nextVersion },
  });

  return NextResponse.json({ success: true, data: draft }, { status: 201 });
}
