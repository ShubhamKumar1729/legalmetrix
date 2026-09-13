/**
 * Data access layer.
 *
 * Every read/write in the application goes through `db`. Each collection is backed by
 * MongoDB when a connection is available and by the in-memory store otherwise. Both
 * paths start EMPTY — the application never invents business records.
 */
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from './connection';
import { memoryDB, type MemoryCollection } from './memory-store';
import {
  AuditLogModel,
  EcommerceListingModel,
  InspectionModel,
  ProductModel,
  ReportModel,
  RuleModel,
  UserModel,
} from './models';
import type {
  AuditLog,
  EcommerceListing,
  Inspection,
  Product,
  RegulatoryRule,
  Report,
  User,
} from '@/types';

export interface ListOptions {
  sortDescBy?: 'createdAt' | 'updatedAt' | 'timestamp';
  limit?: number;
  skip?: number;
}

export interface Repository<T extends { id: string }> {
  kind(): Promise<'mongodb' | 'memory'>;
  list(filter?: Record<string, any>, options?: ListOptions): Promise<T[]>;
  get(id: string): Promise<T | null>;
  findOne(filter: Record<string, any>): Promise<T | null>;
  create(data: Omit<T, 'id'> & { id?: string }): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  remove(id: string): Promise<boolean>;
  count(filter?: Record<string, any>): Promise<number>;
}

type Mapper<D> = (doc: D) => any;

function buildRepository<T extends { id: string }>(config: {
  memory: MemoryCollection<T>;
  model: any;
  toDoc: Mapper<any>;
  toWrite?: (data: any) => any;
}): Repository<T> {
  const { memory, model, toDoc, toWrite } = config;

  const hasMongo = async (): Promise<boolean> => (await connectDB());

  return {
    async kind() {
      return (await hasMongo()) ? 'mongodb' : 'memory';
    },

    async list(filter = {}, options = {}) {
      if (await hasMongo()) {
        let query = model.find(filter);
        if (options.sortDescBy) query = query.sort({ [options.sortDescBy]: -1 });
        if (options.skip) query = query.skip(options.skip);
        if (options.limit) query = query.limit(options.limit);
        const docs = await query;
        return docs.map(toDoc) as T[];
      }
      const all = memory.all().filter((item) =>
        Object.entries(filter).every(([key, value]) => (item as any)[key] === value)
      );
      if (options.sortDescBy) {
        const key = options.sortDescBy;
        all.sort((a: any, b: any) => new Date(b[key] || 0).getTime() - new Date(a[key] || 0).getTime());
      }
      const skipped = options.skip ? all.slice(options.skip) : all;
      return options.limit ? skipped.slice(0, options.limit) : skipped;
    },

    async get(id) {
      if (await hasMongo()) {
        const doc = await model.findById(id).catch(() => null);
        return doc ? (toDoc(doc) as T) : null;
      }
      return memory.findById(id);
    },

    async findOne(filter) {
      if (await hasMongo()) {
        const doc = await model.findOne(filter);
        return doc ? (toDoc(doc) as T) : null;
      }
      const all = memory.all();
      return (
        all.find((item) =>
          Object.entries(filter).every(([key, value]) => (item as any)[key] === value)
        ) || null
      );
    },

    async create(data) {
      const record = { ...(data as any), id: (data as any).id || uuidv4() } as T;
      if (await hasMongo()) {
        const payload = toWrite ? toWrite(record) : record;
        const doc = await model.create(payload);
        return toDoc(doc) as T;
      }
      return memory.create(record as any);
    },

    async update(id, patch) {
      if (await hasMongo()) {
        const payload = toWrite ? toWrite({ ...patch, id }) : patch;
        const doc = await model.findByIdAndUpdate(id, { $set: payload }, { new: true });
        return doc ? (toDoc(doc) as T) : null;
      }
      return memory.update(id, patch);
    },

    async remove(id) {
      if (await hasMongo()) {
        const res = await model.findByIdAndDelete(id);
        return !!res;
      }
      return memory.delete(id);
    },

    async count(filter = {}) {
      if (await hasMongo()) {
        return model.countDocuments(filter);
      }
      const all = memory.all();
      return all.filter((item) =>
        Object.entries(filter).every(([key, value]) => (item as any)[key] === value)
      ).length;
    },
  };
}

const iso = (value?: Date | string | null) =>
  value ? (value instanceof Date ? value.toISOString() : value) : new Date(0).toISOString();

/* ------------------------------------------------------------------ Users */

type StoredUser = User & { passwordHash?: string };

export const users: Repository<StoredUser> = buildRepository<StoredUser>({
  memory: memoryDB.users,
  model: UserModel,
  toDoc: (doc) => ({
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    officialId: doc.officialId || '',
    role: doc.role,
    department: doc.department || '',
    passwordHash: doc.passwordHash,
    active: doc.active,
    lastLogin: doc.lastLogin ? doc.lastLogin.toISOString() : undefined,
    createdAt: iso(doc.createdAt),
  }),
  toWrite: (data) => {
    const { id, createdAt, lastLogin, ...rest } = data;
    return { ...rest, lastLogin: lastLogin ? new Date(lastLogin) : undefined };
  },
});

/* ----------------------------------------------------------- Inspections */

export const inspections: Repository<Inspection> = buildRepository<Inspection>({
  memory: memoryDB.inspections,
  model: InspectionModel,
  toDoc: (doc) => ({
    ...doc.toObject(),
    id: doc._id.toString(),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
    images: doc.images || [],
    findings: doc.findings || [],
    extractedFields: doc.extractedFields || [],
    analysisNotes: doc.analysisNotes || [],
  }),
  toWrite: (data) => {
    const { id, createdAt, updatedAt, ...rest } = data;
    return rest;
  },
});

/* --------------------------------------------------------------- Products */

export const products: Repository<Product> = buildRepository<Product>({
  memory: memoryDB.products,
  model: ProductModel,
  toDoc: (doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    brand: doc.brand || '',
    manufacturer: doc.manufacturer || '',
    category: doc.category || 'OTHER',
    barcode: doc.barcode || '',
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  }),
  toWrite: (data) => {
    const { id, createdAt, updatedAt, ...rest } = data;
    return rest;
  },
});

/* ---------------------------------------------------------------- Reports */

export const reports: Repository<Report> = buildRepository<Report>({
  memory: memoryDB.reports,
  model: ReportModel,
  toDoc: (doc) => ({
    id: doc._id.toString(),
    reportNumber: doc.reportNumber,
    inspectionId: doc.inspectionId,
    inspectionNumber: doc.inspectionNumber,
    productName: doc.productName,
    status: doc.status,
    complianceScore: doc.complianceScore,
    generatedBy: doc.generatedBy,
    generatedByName: doc.generatedByName,
    summary: doc.summary || '',
    createdAt: iso(doc.createdAt),
  }),
  toWrite: (data) => {
    const { id, createdAt, ...rest } = data;
    return rest;
  },
});

/* ------------------------------------------------------------------ Rules */

export const rules: Repository<RegulatoryRule> = buildRepository<RegulatoryRule>({
  memory: memoryDB.rules,
  model: RuleModel,
  toDoc: (doc) => ({
    id: doc._id.toString(),
    ruleCode: doc.ruleCode,
    title: doc.title,
    description: doc.description || '',
    legalReference: doc.legalReference || '',
    category: doc.category || 'GENERAL',
    applicableProductCategories: doc.applicableProductCategories || ['ALL'],
    requirementType: doc.requirementType,
    validationLogic: doc.validationLogic,
    severity: doc.severity,
    enabled: doc.enabled,
    effectiveFrom: doc.effectiveFrom || '',
    effectiveTo: doc.effectiveTo,
    version: doc.version || '1.0',
    evidenceRequired: doc.evidenceRequired,
    reviewRequired: doc.reviewRequired,
    createdBy: doc.createdBy || '',
    updatedBy: doc.updatedBy || '',
    status: doc.status,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  }),
  toWrite: (data) => {
    const { id, createdAt, updatedAt, ...rest } = data;
    return rest;
  },
});

/* -------------------------------------------------------------- Audit log */

export const auditLogs: Repository<AuditLog> = buildRepository<AuditLog>({
  memory: memoryDB.auditLogs,
  model: AuditLogModel,
  toDoc: (doc) => ({
    id: doc._id.toString(),
    timestamp: iso(doc.timestamp),
    userId: doc.userId,
    userName: doc.userName,
    role: doc.role,
    action: doc.action,
    resource: doc.resource,
    resourceId: doc.resourceId,
    oldValue: doc.oldValue,
    newValue: doc.newValue,
    ip: doc.ip,
    comment: doc.comment,
  }),
  toWrite: (data) => {
    const { id, timestamp, ...rest } = data;
    return { ...rest, timestamp: new Date(timestamp) };
  },
});

/* --------------------------------------------------------- E-commerce data */

export const ecommerceListings: Repository<EcommerceListing> = buildRepository<EcommerceListing>({
  memory: memoryDB.ecommerceListings,
  model: EcommerceListingModel,
  toDoc: (doc) => ({
    id: doc._id.toString(),
    url: doc.url,
    platform: doc.platform,
    productName: doc.productName,
    brand: doc.brand,
    mrp: doc.mrp,
    netQuantity: doc.netQuantity,
    manufacturer: doc.manufacturer,
    images: doc.images || [],
    extractedAt: doc.extractedAt,
    complianceComparison: doc.complianceComparison,
  }),
  toWrite: (data) => {
    const { id, ...rest } = data;
    return rest;
  },
});

export const db = {
  users,
  inspections,
  products,
  reports,
  rules,
  auditLogs,
  ecommerceListings,
};
