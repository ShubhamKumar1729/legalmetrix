import { NextRequest, NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  await seedMemoryDB();
  const inspections = memoryDB.inspections.all();
  
  // Generate reports from inspections
  const reports = inspections.map(ins => ({
    id: `rep-${ins.id}`,
    reportId: `RPT-${ins.inspectionId}`,
    inspectionId: ins.id,
    inspectionNumber: ins.inspectionId,
    productName: ins.productName,
    brand: ins.brand,
    manufacturer: ins.manufacturer,
    status: ins.status,
    complianceScore: ins.complianceScore,
    inspector: ins.inspectorName,
    date: ins.createdAt,
    ruleVersion: ins.ruleSetVersion,
    aiModel: 'mock-vision-v0.1.0',
  }));

  return NextResponse.json({ success: true, data: reports });
}

export async function POST(req: NextRequest) {
  await seedMemoryDB();
  const { inspectionId } = await req.json();
  
  const inspection = await memoryDB.inspections.findById(inspectionId) || 
    memoryDB.inspections.all().find(i => i.inspectionId === inspectionId);

  if (!inspection) {
    return NextResponse.json({ success: false, error: { message: 'Inspection not found' } }, { status: 404 });
  }

  const report = {
    id: uuidv4(),
    reportId: `RPT-${inspection.inspectionId}`,
    inspectionId: inspection.id,
    productName: inspection.productName,
    status: inspection.status,
    complianceScore: inspection.complianceScore,
    generatedAt: new Date().toISOString(),
    content: {
      inspection,
      findings: inspection.findings,
      extractedFields: inspection.extractedFields,
      evidence: inspection.images,
      ruleSetVersion: inspection.ruleSetVersion,
      aiRunId: inspection.aiRunId,
    }
  };

  await memoryDB.reports.create(report as any);

  return NextResponse.json({ success: true, data: report });
}
