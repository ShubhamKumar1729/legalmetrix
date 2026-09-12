import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/audit/audit';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';

export async function GET(req: NextRequest) {
  await seedMemoryDB();
  const { searchParams } = new URL(req.url);
  const resource = searchParams.get('resource') || undefined;
  const limit = parseInt(searchParams.get('limit') || '100');

  const logs = await getAuditLogs({ resource, limit });

  // If no logs, generate some demo
  if (logs.length === 0) {
    const demoLogs = [
      { id: 'audit-1', timestamp: new Date().toISOString(), userId: 'user-officer', userName: 'Rajesh Kumar', role: 'ENFORCEMENT_OFFICER', action: 'INSPECTION_CREATED', resource: 'INSPECTION', resourceId: 'insp-001', comment: 'Field inspection started' },
      { id: 'audit-2', timestamp: new Date(Date.now() - 60000*5).toISOString(), userId: 'user-officer', userName: 'Rajesh Kumar', role: 'ENFORCEMENT_OFFICER', action: 'AI_ANALYSIS_COMPLETED', resource: 'INSPECTION', resourceId: 'insp-001', comment: 'Mock AI v0.1.0 analysis' },
      { id: 'audit-3', timestamp: new Date(Date.now() - 60000*30).toISOString(), userId: 'user-super-admin', userName: 'Super Admin', role: 'SUPER_ADMIN', action: 'RULE_PUBLISHED', resource: 'RULE', resourceId: 'rule-004', comment: 'Published LM-PC-2011-6(1)(e) v1.2' },
    ];
    return NextResponse.json({ success: true, data: demoLogs });
  }

  return NextResponse.json({ success: true, data: logs });
}
