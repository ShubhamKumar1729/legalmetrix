import { NextRequest, NextResponse } from 'next/server';
import { guardRequest } from '@/lib/auth/session';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '@/lib/audit/audit';

export async function GET(req: NextRequest) {
  const denied = guardRequest(req, 'rule:read'); if (denied) return denied;
  await seedMemoryDB();
  const rules = memoryDB.rules.all().sort((a, b) => a.ruleCode.localeCompare(b.ruleCode));
  return NextResponse.json({ success: true, data: rules });
}

export async function POST(req: NextRequest) {
  const denied = guardRequest(req, 'rule:write'); if (denied) return denied;
  await seedMemoryDB();
  const body = await req.json();

  const rule: any = {
    id: uuidv4(),
    ruleCode: body.ruleCode || `LM-PC-2011-${Date.now()}`,
    title: body.title,
    description: body.description,
    legalReference: body.legalReference,
    category: body.category,
    applicableProductCategories: body.applicableProductCategories || ['ALL'],
    requirementType: body.requirementType || 'MANDATORY',
    validationLogic: body.validationLogic || { field: 'mrp', operator: 'exists' },
    severity: body.severity || 'MEDIUM',
    enabled: body.enabled ?? true,
    effectiveFrom: body.effectiveFrom || new Date().toISOString(),
    effectiveTo: body.effectiveTo,
    version: body.version || '1.0',
    evidenceRequired: body.evidenceRequired ?? true,
    reviewRequired: body.reviewRequired ?? false,
    createdBy: body.createdBy || 'user-super-admin',
    updatedBy: body.createdBy || 'user-super-admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: body.status || 'DRAFT',
  };

  await memoryDB.rules.create(rule);

  await logAudit({
    userId: rule.createdBy,
    userName: 'Admin',
    role: 'REGULATORY_ADMIN',
    action: 'RULE_CREATED',
    resource: 'RULE',
    resourceId: rule.id,
    newValue: rule,
  });

  return NextResponse.json({ success: true, data: rule });
}
