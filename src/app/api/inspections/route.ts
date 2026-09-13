import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse, badRequest } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { storage } from '@/lib/storage/local-storage';
import { logAudit } from '@/lib/audit/audit';
import { getSystemConfig } from '@/lib/config/system';
import type { Inspection, ProductImage } from '@/types';

const CATEGORIES = ['FOOD', 'COSMETICS', 'GROCERY', 'ELECTRONICS', 'TEXTILES', 'OTHER'];
const SOURCES = ['FIELD', 'ECOMMERCE', 'UPLOAD'];

async function nextInspectionNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LM-${year}-`;
  const existing = await db.inspections.count();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}${String(existing + attempt + 1).padStart(6, '0')}`;
    const clash = await db.inspections.findOne({ inspectionNumber: candidate });
    if (!clash) return candidate;
  }
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

async function findOrCreateProduct(input: {
  productName: string;
  brand: string;
  manufacturer: string;
  category: string;
  barcode?: string;
}) {
  const existing = await db.products.findOne({ name: input.productName });
  if (existing) return existing;

  return db.products.create({
    name: input.productName,
    brand: input.brand,
    manufacturer: input.manufacturer,
    category: input.category,
    barcode: input.barcode || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  const user = requirePermission('inspection:read');
  if (isResponse(user)) return user;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
  const status = searchParams.get('status');
  const q = (searchParams.get('q') || '').toLowerCase().trim();

  const all = await db.inspections.list({}, { sortDescBy: 'createdAt' });

  let filtered = all;
  if (status) filtered = filtered.filter((i) => i.status === status);
  if (q) {
    filtered = filtered.filter((i) =>
      [i.productName, i.brand, i.manufacturer, i.inspectionNumber].some((field) =>
        (field || '').toLowerCase().includes(q)
      )
    );
  }

  return NextResponse.json({
    success: true,
    data: { inspections: filtered.slice(0, limit), total: filtered.length },
  });
}

export async function POST(req: NextRequest) {
  const user = requirePermission('inspection:create');
  if (isResponse(user)) return user;

  const body = await req.json().catch(() => ({}));
  const config = getSystemConfig();

  const productName = String(body.productName || '').trim();
  const manufacturer = String(body.manufacturer || '').trim();
  const brand = String(body.brand || '').trim();
  const category = CATEGORIES.includes(body.category) ? body.category : 'OTHER';
  const rawImages = Array.isArray(body.images) ? body.images : [];

  if (!productName) return badRequest('Product name is required.');
  if (!manufacturer) return badRequest('Manufacturer, packer or importer is required.');
  if (rawImages.length === 0) return badRequest('At least one package image is required.');
  if (rawImages.length > config.inspection.maxImages) {
    return badRequest(`A maximum of ${config.inspection.maxImages} images can be attached to one inspection.`);
  }

  // Every referenced image must really exist in storage — never trust a client-supplied URL.
  const images: ProductImage[] = [];
  for (const [index, raw] of rawImages.entries()) {
    const stored = await storage.read(String(raw?.id || ''));
    if (!stored) {
      return badRequest(`Image ${index + 1} could not be found. Please capture or upload it again.`);
    }
    images.push({
      id: String(raw.id),
      inspectionId: '',
      side: raw.side || 'ADDITIONAL',
      url: `/api/images/${raw.id}`,
      originalName: String(raw.originalName || `image-${index + 1}`),
      size: Number(raw.size) || stored.buffer.length,
      mimeType: stored.mimeType,
      width: Number(raw.width) || undefined,
      height: Number(raw.height) || undefined,
      source: raw.source === 'CAMERA' ? 'CAMERA' : 'UPLOAD',
      quality: {
        resolution: Number(raw?.quality?.resolution) || Math.min(Number(raw.width) || 0, Number(raw.height) || 0),
        brightness: raw?.quality?.brightness,
        blurScore: raw?.quality?.blurScore,
        readability: raw?.quality?.readability,
      },
      uploadedAt: new Date().toISOString(),
    });
  }

  const product = await findOrCreateProduct({
    productName,
    brand,
    manufacturer,
    category,
    barcode: body.barcode,
  });

  const inspectionNumber = await nextInspectionNumber();
  const now = new Date().toISOString();

  const inspection: Omit<Inspection, 'id'> = {
    inspectionNumber,
    productId: product.id,
    productName,
    brand,
    category,
    manufacturer,
    barcode: body.barcode || undefined,
    batchNumber: body.batchNumber || undefined,
    inspectorId: user.id,
    inspectorName: user.name,
    status: 'DRAFT',
    source: SOURCES.includes(body.source) ? body.source : 'FIELD',
    images: images.map((image) => ({ ...image })),
    location: body.location || undefined,
    startedAt: now,
    ruleSetVersion: process.env.DEFAULT_RULESET_VERSION || 'LM-PC-2011',
    rulesEvaluated: 0,
    complianceScore: 0,
    scored: false,
    confidenceSummary: { average: 0, min: 0, max: 0, lowConfidenceCount: 0 },
    findings: [],
    extractedFields: [],
    analysisNotes: [],
    reviewStatus: 'NOT_REQUIRED',
    createdAt: now,
    updatedAt: now,
  };

  const created = await db.inspections.create(inspection);
  const withIds = await db.inspections.update(created.id, {
    images: images.map((image) => ({ ...image, inspectionId: created.id })),
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    role: user.role,
    action: 'INSPECTION_CREATED',
    resource: 'INSPECTION',
    resourceId: created.id,
    newValue: { inspectionNumber, productName, imageCount: images.length },
  });

  return NextResponse.json({ success: true, data: withIds || created }, { status: 201 });
}
