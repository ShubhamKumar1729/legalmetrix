/**
 * In-Memory Store for demo / fallback when MongoDB not available
 * Production would use MongoDB via Mongoose
 */
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

class MemoryCollection<T extends { id: string }> {
  private items: Map<string, T> = new Map();

  async create(data: Omit<T, 'id'> & Partial<{ id: string }>): Promise<T> {
    const id = (data as any).id || uuidv4();
    const item = { ...data, id } as T;
    this.items.set(id, item);
    return item;
  }

  async findById(id: string): Promise<T | null> {
    return this.items.get(id) || null;
  }

  async findOne(query: Partial<T>): Promise<T | null> {
    for (const item of this.items.values()) {
      let match = true;
      for (const [k, v] of Object.entries(query)) {
        if ((item as any)[k] !== v) {
          match = false;
          break;
        }
      }
      if (match) return item;
    }
    return null;
  }

  async find(query: Partial<T> = {}, options?: { limit?: number; skip?: number; sort?: any }): Promise<T[]> {
    let results = Array.from(this.items.values()).filter(item => {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) continue;
        if ((item as any)[k] !== v) return false;
      }
      return true;
    });

    if (options?.sort) {
      const sortKey = Object.keys(options.sort)[0];
      const dir = options.sort[sortKey];
      results.sort((a: any, b: any) => {
        if (a[sortKey] < b[sortKey]) return dir === 1 ? -1 : 1;
        if (a[sortKey] > b[sortKey]) return dir === 1 ? 1 : -1;
        return 0;
      });
    }

    if (options?.skip) results = results.slice(options.skip);
    if (options?.limit) results = results.slice(0, options.limit);
    return results;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, id } as T;
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async count(query: Partial<T> = {}): Promise<number> {
    const res = await this.find(query);
    return res.length;
  }

  async clear() {
    this.items.clear();
  }

  all(): T[] {
    return Array.from(this.items.values());
  }
}

import type { Inspection, RegulatoryRule, User, AuditLog, EcommerceListing } from '@/types';

function createMemoryDB() {
  return {
    users: new MemoryCollection<User>(),
    inspections: new MemoryCollection<Inspection>(),
    rules: new MemoryCollection<RegulatoryRule>(),
    auditLogs: new MemoryCollection<AuditLog>(),
    ecommerceListings: new MemoryCollection<EcommerceListing>(),
    products: new MemoryCollection<any>(),
    reports: new MemoryCollection<any>(),
    notifications: new MemoryCollection<any>(),
  };
}

/**
 * IMPORTANT: pinned to globalThis so every route bundle shares ONE store.
 * Without this, Next.js dev mode compiles each API route into its own module
 * graph, each route gets a fresh copy of the data, and created inspections
 * would be "not found" by the analyze route.
 */
const g = globalThis as unknown as { __legalmetrixMemoryDB?: ReturnType<typeof createMemoryDB> };
export const memoryDB = (g.__legalmetrixMemoryDB ??= createMemoryDB());

let seeding: Promise<void> | null = null;

export async function seedMemoryDB() {
  if (memoryDB.users.all().length > 0) return;
  if (seeding) return seeding;
  seeding = doSeed().finally(() => { seeding = null; });
  return seeding;
}

async function doSeed() {
  if (memoryDB.users.all().length > 0) return;

  const now = new Date().toISOString();
  const demoHash = bcrypt.hashSync('Gov@2026', 10);

  // Users
  const users: User[] = [
    {
      id: 'user-super-admin',
      email: 'admin@gov.in',
      name: 'Super Administrator',
      officialId: 'GOV-SA-001',
      role: 'SUPER_ADMIN',
      department: 'Department of Consumer Affairs',
      active: true,
      createdAt: now,
      lastLogin: now,
    },
    {
      id: 'user-officer',
      email: 'officer@gov.in',
      name: 'Rajesh Kumar',
      officialId: 'GOV-EO-042',
      role: 'ENFORCEMENT_OFFICER',
      department: 'Legal Metrology - Punjab',
      active: true,
      createdAt: now,
      lastLogin: now,
    },
    {
      id: 'user-reviewer',
      email: 'reviewer@gov.in',
      name: 'Priya Sharma',
      officialId: 'GOV-RV-018',
      role: 'REVIEWER',
      department: 'Legal Metrology - Central',
      active: true,
      createdAt: now,
    },
    {
      id: 'user-analyst',
      email: 'analyst@gov.in',
      name: 'Amit Patel',
      officialId: 'GOV-AN-007',
      role: 'ANALYST',
      department: 'Enforcement Analytics',
      active: true,
      createdAt: now,
    },
  ];

  for (const u of users) await memoryDB.users.create({ ...u, passwordHash: demoHash } as any);

  // Rules - LM-PC-2011
  const rules: RegulatoryRule[] = [
    {
      id: 'rule-001',
      ruleCode: 'LM-PC-2011-6(1)(a)',
      title: 'Name and Address of Manufacturer/Packer/Importer',
      description: 'Every package shall bear thereon the name and complete address of manufacturer/packer/importer',
      legalReference: 'Legal Metrology (Packaged Commodities) Rules, 2011 - Rule 6(1)(a)',
      category: 'MANUFACTURER_INFO',
      applicableProductCategories: ['ALL'],
      requirementType: 'MANDATORY',
      validationLogic: { field: 'manufacturer_address', operator: 'exists' },
      severity: 'CRITICAL',
      enabled: true,
      effectiveFrom: '2011-04-01',
      version: '1.2',
      evidenceRequired: true,
      reviewRequired: false,
      createdBy: 'user-super-admin',
      updatedBy: 'user-super-admin',
      createdAt: now,
      updatedAt: now,
      status: 'PUBLISHED',
    },
    {
      id: 'rule-002',
      ruleCode: 'LM-PC-2011-6(1)(b)',
      title: 'Common or Generic Name of Commodity',
      description: 'Package must declare common/generic name of commodity contained',
      legalReference: 'Rule 6(1)(b)',
      category: 'PRODUCT_IDENTITY',
      applicableProductCategories: ['ALL'],
      requirementType: 'MANDATORY',
      validationLogic: { field: 'product_name', operator: 'exists' },
      severity: 'CRITICAL',
      enabled: true,
      effectiveFrom: '2011-04-01',
      version: '1.2',
      evidenceRequired: true,
      reviewRequired: false,
      createdBy: 'user-super-admin',
      updatedBy: 'user-super-admin',
      createdAt: now,
      updatedAt: now,
      status: 'PUBLISHED',
    },
    {
      id: 'rule-003',
      ruleCode: 'LM-PC-2011-6(1)(c)',
      title: 'Net Quantity Declaration',
      description: 'Net quantity in terms of standard unit of weight/measure',
      legalReference: 'Rule 6(1)(c)',
      category: 'NET_QUANTITY',
      applicableProductCategories: ['ALL'],
      requirementType: 'MANDATORY',
      validationLogic: { field: 'net_quantity', operator: 'exists' },
      severity: 'CRITICAL',
      enabled: true,
      effectiveFrom: '2011-04-01',
      version: '1.2',
      evidenceRequired: true,
      reviewRequired: false,
      createdBy: 'user-super-admin',
      updatedBy: 'user-super-admin',
      createdAt: now,
      updatedAt: now,
      status: 'PUBLISHED',
    },
    {
      id: 'rule-004',
      ruleCode: 'LM-PC-2011-6(1)(e)',
      title: 'MRP Declaration',
      description: 'Retail sale price in form MRP Rs/₹ ... inclusive of all taxes',
      legalReference: 'Rule 6(1)(e)',
      category: 'MRP',
      applicableProductCategories: ['ALL'],
      requirementType: 'MANDATORY',
      validationLogic: { field: 'mrp', operator: 'exists' },
      severity: 'CRITICAL',
      enabled: true,
      effectiveFrom: '2011-04-01',
      version: '1.2',
      evidenceRequired: true,
      reviewRequired: false,
      createdBy: 'user-super-admin',
      updatedBy: 'user-super-admin',
      createdAt: now,
      updatedAt: now,
      status: 'PUBLISHED',
    },
    {
      id: 'rule-005',
      ruleCode: 'LM-PC-2011-6(1)(f)',
      title: 'Consumer Care Details',
      description: 'Name, address, telephone, email of person to be contacted in case of consumer complaints',
      legalReference: 'Rule 6(1)(f)',
      category: 'CONSUMER_CARE',
      applicableProductCategories: ['ALL'],
      requirementType: 'MANDATORY',
      validationLogic: { field: 'customer_care', operator: 'exists' },
      severity: 'HIGH',
      enabled: true,
      effectiveFrom: '2011-04-01',
      version: '1.2',
      evidenceRequired: true,
      reviewRequired: true,
      createdBy: 'user-super-admin',
      updatedBy: 'user-super-admin',
      createdAt: now,
      updatedAt: now,
      status: 'PUBLISHED',
    },
    {
      id: 'rule-006',
      ruleCode: 'LM-PC-2011-8',
      title: 'MRP Font Size & Visibility',
      description: 'MRP and declarations must be readable, prominent, with minimum font size',
      legalReference: 'Rule 8 - General provisions relating to declaration',
      category: 'READABILITY',
      applicableProductCategories: ['ALL'],
      requirementType: 'MANDATORY',
      validationLogic: { field: 'mrp_font_size', operator: 'gte', value: 1 },
      severity: 'MEDIUM',
      enabled: true,
      effectiveFrom: '2011-04-01',
      version: '1.1',
      evidenceRequired: true,
      reviewRequired: true,
      createdBy: 'user-super-admin',
      updatedBy: 'user-super-admin',
      createdAt: now,
      updatedAt: now,
      status: 'PUBLISHED',
    },
    {
      id: 'rule-007',
      ruleCode: 'LM-PC-2011-6(1)(d)',
      title: 'Month and Year of Manufacture/Packing',
      description: 'Every package must declare month and year of manufacture/packing/import',
      legalReference: 'Rule 6(1)(d)',
      category: 'DATE_DECLARATION',
      applicableProductCategories: ['ALL'],
      requirementType: 'MANDATORY',
      validationLogic: { field: 'manufacture_date', operator: 'exists' },
      severity: 'HIGH',
      enabled: true,
      effectiveFrom: '2011-04-01',
      version: '1.2',
      evidenceRequired: true,
      reviewRequired: false,
      createdBy: 'user-super-admin',
      updatedBy: 'user-super-admin',
      createdAt: now,
      updatedAt: now,
      status: 'PUBLISHED',
    },
    {
      id: 'rule-008',
      ruleCode: 'LM-PC-2011-10',
      title: 'Unit Sale Price Declaration',
      description: 'For packages above certain quantity, unit sale price must be declared',
      legalReference: 'Rule 10 - Unit Sale Price',
      category: 'UNIT_PRICE',
      applicableProductCategories: ['FOOD', 'GROCERY'],
      requirementType: 'CONDITIONAL',
      validationLogic: {
        logic: 'AND',
        conditions: [
          { field: 'category', operator: 'in', value: ['FOOD', 'GROCERY'] },
          { field: 'net_quantity_value', operator: 'gte', value: 1000 }
        ]
      },
      severity: 'MEDIUM',
      enabled: true,
      effectiveFrom: '2022-01-01',
      version: '1.0',
      evidenceRequired: false,
      reviewRequired: true,
      createdBy: 'user-super-admin',
      updatedBy: 'user-super-admin',
      createdAt: now,
      updatedAt: now,
      status: 'PUBLISHED',
    },
  ];

  for (const r of rules) await memoryDB.rules.create(r);

  // Sample inspections
  const inspections: Inspection[] = [
    {
      id: 'insp-001',
      inspectionId: 'LM-2026-001042',
      productId: 'prod-freshbite',
      productName: 'FreshBite Premium Biscuits',
      brand: 'FreshBite',
      category: 'FOOD',
      manufacturer: 'FreshBite Foods Pvt Ltd, Ludhiana',
      barcode: '8901234567890',
      batchNumber: 'FB-2026-08-A',
      inspectorId: 'user-officer',
      inspectorName: 'Rajesh Kumar',
      status: 'REVIEW_REQUIRED',
      source: 'FIELD',
      images: [
        {
          id: 'img-001-f',
          inspectionId: 'insp-001',
          side: 'FRONT',
          url: '/api/placeholder/image?text=FreshBite+Front',
          originalName: 'front.jpg',
          size: 2400000,
          mimeType: 'image/jpeg',
          quality: { resolution: 300, blurScore: 0.12, brightness: 0.85, readability: 0.92, coverage: 0.88 },
          uploadedAt: now,
        },
        {
          id: 'img-001-b',
          inspectionId: 'insp-001',
          side: 'BACK',
          url: '/api/placeholder/image?text=FreshBite+Back',
          originalName: 'back.jpg',
          size: 2600000,
          mimeType: 'image/jpeg',
          quality: { resolution: 300, blurScore: 0.15, brightness: 0.82, readability: 0.88, coverage: 0.91 },
          uploadedAt: now,
        },
      ],
      location: { latitude: 30.9009, longitude: 75.8573, accuracy: 12, address: 'Ludhiana, Punjab' },
      startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      aiRunId: 'ai-run-001',
      ruleSetVersion: 'LM-PC-2011-v1.2',
      complianceScore: 82,
      confidenceSummary: { average: 89, min: 71, max: 98, lowConfidenceCount: 1 },
      findings: [
        {
          id: 'find-001-1',
          inspectionId: 'insp-001',
          declarationType: 'MRP',
          title: 'MRP Declaration',
          description: 'Retail sale price declaration found and valid',
          detectedValue: '₹99',
          expectedValue: 'MRP inclusive of all taxes',
          status: 'PASS',
          severity: 'CRITICAL',
          confidence: 98,
          ruleId: 'rule-004',
          ruleCode: 'LM-PC-2011-6(1)(e)',
          legalReference: 'Rule 6(1)(e)',
          evidence: [{ imageId: 'img-001-f', boundingBox: { x: 120, y: 300, width: 80, height: 25 } }],
          reviewStatus: 'AI_CONFIRMED',
          createdAt: now,
        },
        {
          id: 'find-001-2',
          inspectionId: 'insp-001',
          declarationType: 'NET_QUANTITY',
          title: 'Net Quantity',
          description: 'Net quantity declared as 500g',
          detectedValue: '500 g',
          expectedValue: 'Standard unit',
          status: 'PASS',
          severity: 'CRITICAL',
          confidence: 96,
          ruleId: 'rule-003',
          ruleCode: 'LM-PC-2011-6(1)(c)',
          legalReference: 'Rule 6(1)(c)',
          evidence: [{ imageId: 'img-001-f', boundingBox: { x: 120, y: 340, width: 100, height: 22 } }],
          reviewStatus: 'AI_CONFIRMED',
          createdAt: now,
        },
        {
          id: 'find-001-3',
          inspectionId: 'insp-001',
          declarationType: 'MANUFACTURER',
          title: 'Manufacturer Address',
          description: 'Manufacturer address detected but low confidence due to multilingual script',
          detectedValue: 'FreshBite Foods Pvt Ltd, GT Road, Ludhiana - 141001',
          expectedValue: 'Complete address required',
          status: 'REVIEW',
          severity: 'CRITICAL',
          confidence: 71,
          ruleId: 'rule-001',
          ruleCode: 'LM-PC-2011-6(1)(a)',
          legalReference: 'Rule 6(1)(a)',
          evidence: [{ imageId: 'img-001-b', boundingBox: { x: 40, y: 100, width: 280, height: 60 } }],
          reviewStatus: 'PENDING',
          createdAt: now,
        },
        {
          id: 'find-001-4',
          inspectionId: 'insp-001',
          declarationType: 'CUSTOMER_CARE',
          title: 'Consumer Care Details',
          description: 'Consumer care contact missing',
          status: 'VIOLATION',
          severity: 'HIGH',
          confidence: 94,
          ruleId: 'rule-005',
          ruleCode: 'LM-PC-2011-6(1)(f)',
          legalReference: 'Rule 6(1)(f)',
          evidence: [],
          reviewStatus: 'PENDING',
          createdAt: now,
        },
      ],
      extractedFields: [
        {
          id: 'ef-001-1',
          fieldName: 'mrp',
          value: '₹99',
          normalizedValue: '99.00',
          rawText: 'MRP Rs. 99/-',
          language: 'en',
          script: 'Latin',
          confidence: 98,
          sourceImageId: 'img-001-f',
          boundingBox: { x: 120, y: 300, width: 80, height: 25 },
          status: 'PASS',
          editable: true,
          reviewStatus: 'AI_CONFIRMED',
          ruleCode: 'LM-PC-2011-6(1)(e)',
        },
        {
          id: 'ef-001-2',
          fieldName: 'net_quantity',
          value: '500 g',
          normalizedValue: '500',
          rawText: 'Net Wt. 500g',
          language: 'en',
          script: 'Latin',
          confidence: 96,
          sourceImageId: 'img-001-f',
          boundingBox: { x: 120, y: 340, width: 100, height: 22 },
          status: 'PASS',
          editable: true,
          reviewStatus: 'AI_CONFIRMED',
        },
        {
          id: 'ef-001-3',
          fieldName: 'manufacturer_address',
          value: 'FreshBite Foods Pvt Ltd, GT Road, Ludhiana - 141001',
          normalizedValue: 'FreshBite Foods Pvt Ltd, GT Road, Ludhiana - 141001',
          rawText: 'Mfd. by: FreshBite Foods Pvt Ltd, GT Road, Ludhiana - 141001',
          language: 'en',
          script: 'Latin',
          confidence: 71,
          sourceImageId: 'img-001-b',
          boundingBox: { x: 40, y: 100, width: 280, height: 60 },
          status: 'REVIEW',
          editable: true,
          reviewStatus: 'PENDING',
        },
      ],
      reviewStatus: 'PENDING',
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      updatedAt: now,
    },
    {
      id: 'insp-002',
      inspectionId: 'LM-2026-001043',
      productId: 'prod-pureharvest',
      productName: 'PureHarvest Basmati Rice',
      brand: 'PureHarvest',
      category: 'FOOD',
      manufacturer: 'PureHarvest Agro Industries, Karnal',
      barcode: '8901234567891',
      inspectorId: 'user-officer',
      inspectorName: 'Rajesh Kumar',
      status: 'COMPLIANT',
      source: 'FIELD',
      images: [
        {
          id: 'img-002-f',
          inspectionId: 'insp-002',
          side: 'FRONT',
          url: '/api/placeholder/image?text=PureHarvest+Front',
          originalName: 'front.jpg',
          size: 2200000,
          mimeType: 'image/jpeg',
          quality: { resolution: 300, blurScore: 0.08, brightness: 0.88, readability: 0.95, coverage: 0.92 },
          uploadedAt: now,
        },
      ],
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      ruleSetVersion: 'LM-PC-2011-v1.2',
      complianceScore: 96,
      confidenceSummary: { average: 94, min: 88, max: 99, lowConfidenceCount: 0 },
      findings: [],
      extractedFields: [],
      reviewStatus: 'NOT_REQUIRED',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      updatedAt: now,
    },
    {
      id: 'insp-003',
      inspectionId: 'LM-2026-001044',
      productId: 'prod-cleancare',
      productName: 'CleanCare Shampoo 200ml',
      brand: 'CleanCare',
      category: 'COSMETICS',
      manufacturer: 'CleanCare Labs, Mumbai',
      barcode: '8901234567892',
      inspectorId: 'user-officer',
      inspectorName: 'Rajesh Kumar',
      status: 'NON_COMPLIANT',
      source: 'ECOMMERCE',
      images: [
        {
          id: 'img-003-f',
          inspectionId: 'insp-003',
          side: 'FRONT',
          url: '/api/placeholder/image?text=CleanCare+Front',
          originalName: 'front.jpg',
          size: 1800000,
          mimeType: 'image/jpeg',
          quality: { resolution: 250, blurScore: 0.2, brightness: 0.78, readability: 0.75, coverage: 0.8 },
          uploadedAt: now,
        },
      ],
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
      ruleSetVersion: 'LM-PC-2011-v1.2',
      complianceScore: 45,
      confidenceSummary: { average: 82, min: 65, max: 93, lowConfidenceCount: 2 },
      findings: [],
      extractedFields: [],
      reviewStatus: 'COMPLETED',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      updatedAt: now,
    },
  ];

  for (const insp of inspections) await memoryDB.inspections.create(insp);

  // Products
  for (const p of [
    { id: 'prod-freshbite', name: 'FreshBite Premium Biscuits', brand: 'FreshBite', manufacturer: 'FreshBite Foods Pvt Ltd', category: 'FOOD', inspections: 12, violations: 4, riskScore: 72, lastInspection: now },
    { id: 'prod-pureharvest', name: 'PureHarvest Basmati Rice', brand: 'PureHarvest', manufacturer: 'PureHarvest Agro', category: 'FOOD', inspections: 8, violations: 0, riskScore: 12, lastInspection: now },
    { id: 'prod-cleancare', name: 'CleanCare Shampoo', brand: 'CleanCare', manufacturer: 'CleanCare Labs', category: 'COSMETICS', inspections: 15, violations: 9, riskScore: 89, lastInspection: now },
    { id: 'prod-dailyglow', name: 'DailyGlow Soap', brand: 'DailyGlow', manufacturer: 'DailyGlow Naturals', category: 'COSMETICS', inspections: 5, violations: 1, riskScore: 35, lastInspection: now },
    { id: 'prod-nutripack', name: 'NutriPack Atta', brand: 'NutriPack', manufacturer: 'NutriPack Mills', category: 'FOOD', inspections: 22, violations: 3, riskScore: 48, lastInspection: now },
  ]) {
    await memoryDB.products.create(p as any);
  }

  console.log('Memory DB seeded');
}
