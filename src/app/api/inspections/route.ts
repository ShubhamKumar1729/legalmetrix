import { NextRequest, NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';
import { connectDB, isDBConnected } from '@/lib/db/connection';
import { InspectionModel } from '@/lib/db/models';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '@/lib/audit/audit';

export async function GET(req: NextRequest) {
  await seedMemoryDB();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '50');
  const skip = parseInt(searchParams.get('skip') || '0');

  try {
    // Try MongoDB
    const connected = await connectDB();
    if (connected && isDBConnected()) {
      const query: any = {};
      if (status) query.status = status;
      if (search) {
        query.$text = { $search: search };
      }
      const inspections = await InspectionModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
      const total = await InspectionModel.countDocuments(query);
      return NextResponse.json({ success: true, data: { inspections, total } });
    }
  } catch (e) {
    console.warn('Mongo inspections failed, using memory', e);
  }

  let inspections = memoryDB.inspections.all();

  if (status) inspections = inspections.filter(i => i.status === status);
  if (search) {
    const s = search.toLowerCase();
    inspections = inspections.filter(i => 
      i.productName.toLowerCase().includes(s) ||
      i.brand.toLowerCase().includes(s) ||
      i.manufacturer.toLowerCase().includes(s) ||
      i.inspectionId.toLowerCase().includes(s)
    );
  }

  inspections.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = inspections.length;
  const paginated = inspections.slice(skip, skip + limit);

  return NextResponse.json({ success: true, data: { inspections: paginated, total } });
}

export async function POST(req: NextRequest) {
  await seedMemoryDB();
  try {
    const body = await req.json();
    const id = uuidv4();
    const inspectionId = `LM-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    const inspection: any = {
      id,
      inspectionId,
      productId: body.productId || `prod-${Date.now()}`,
      productName: body.productName || 'Unknown Product',
      brand: body.brand || 'Unknown',
      category: body.category || 'FOOD',
      manufacturer: body.manufacturer || body.manufacturerName || 'Unknown Manufacturer',
      barcode: body.barcode,
      batchNumber: body.batchNumber,
      inspectorId: body.inspectorId || 'user-officer',
      inspectorName: body.inspectorName || 'Rajesh Kumar',
      status: 'DRAFT',
      source: body.source || 'FIELD',
      images: body.images || [],
      location: body.location,
      startedAt: new Date().toISOString(),
      ruleSetVersion: body.ruleSetVersion || 'LM-PC-2011-v1.2',
      complianceScore: 0,
      confidenceSummary: { average: 0, min: 0, max: 0, lowConfidenceCount: 0 },
      findings: [],
      extractedFields: [],
      reviewStatus: 'NOT_REQUIRED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await memoryDB.inspections.create(inspection);

    // Try MongoDB too
    try {
      const connected = await connectDB();
      if (connected && isDBConnected()) {
        await InspectionModel.create({
          inspectionId,
          productName: inspection.productName,
          brand: inspection.brand,
          category: inspection.category,
          manufacturer: inspection.manufacturer,
          barcode: inspection.barcode,
          inspectorId: inspection.inspectorId,
          inspectorName: inspection.inspectorName,
          status: 'DRAFT',
          source: inspection.source,
          images: [],
          ruleSetVersion: inspection.ruleSetVersion,
          complianceScore: 0,
          confidenceSummary: inspection.confidenceSummary,
          findings: [],
          extractedFields: [],
          reviewStatus: 'NOT_REQUIRED',
          startedAt: new Date(),
        });
      }
    } catch {}

    await logAudit({
      userId: inspection.inspectorId,
      userName: inspection.inspectorName,
      role: 'ENFORCEMENT_OFFICER',
      action: 'INSPECTION_CREATED',
      resource: 'INSPECTION',
      resourceId: inspection.id,
      newValue: { inspectionId, productName: inspection.productName },
    });

    return NextResponse.json({ success: true, data: inspection });
  } catch (e) {
    console.error('Create inspection error', e);
    return NextResponse.json({ success: false, error: { message: 'Failed to create inspection' } }, { status: 500 });
  }
}
