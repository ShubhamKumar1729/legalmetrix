/**
 * Mongoose models.
 *
 * Every collection starts empty. Nothing is seeded at startup — records are only
 * ever created through the application (user actions or administrator configuration).
 */
import mongoose, { Schema, type Model } from 'mongoose';

const { models, model } = mongoose;

/* ------------------------------------------------------------------ User */

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    officialId: { type: String, default: '' },
    role: { type: String, required: true },
    department: { type: String, default: '' },
    passwordHash: { type: String, required: true },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

export interface UserDoc extends mongoose.Document {
  email: string;
  name: string;
  officialId: string;
  role: string;
  department: string;
  passwordHash: string;
  active: boolean;
  lastLogin?: Date;
}

export const UserModel: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>('User', UserSchema);

/* ------------------------------------------------------------- Inspection */

const BoundingBoxSchema = new Schema(
  { x: Number, y: Number, width: Number, height: Number, page: Number },
  { _id: false }
);

const ProductImageSchema = new Schema(
  {
    id: { type: String, required: true },
    inspectionId: String,
    side: String,
    url: String,
    originalName: String,
    size: Number,
    mimeType: String,
    width: Number,
    height: Number,
    source: String,
    quality: {
      resolution: Number,
      blurScore: Number,
      brightness: Number,
      readability: Number,
    },
    uploadedAt: String,
  },
  { _id: false }
);

const FindingSchema = new Schema(
  {
    id: { type: String, required: true },
    inspectionId: String,
    declarationType: String,
    title: String,
    description: String,
    detectedValue: String,
    expectedValue: String,
    status: String,
    severity: String,
    confidence: Number,
    ruleId: String,
    ruleCode: String,
    legalReference: String,
    evidence: [{ imageId: String, boundingBox: BoundingBoxSchema, croppedUrl: String }],
    reviewStatus: String,
    correctedValue: String,
    reviewerId: String,
    reviewerName: String,
    reviewerComment: String,
    reviewedAt: String,
    createdAt: String,
  },
  { _id: false }
);

const ExtractedFieldSchema = new Schema(
  {
    id: { type: String, required: true },
    fieldName: String,
    value: String,
    normalizedValue: String,
    rawText: String,
    language: String,
    script: String,
    confidence: Number,
    sourceImageId: String,
    boundingBox: BoundingBoxSchema,
    status: String,
    editable: Boolean,
    reviewStatus: String,
    ruleCode: String,
    evidenceUrl: String,
  },
  { _id: false }
);

const InspectionSchema = new Schema(
  {
    inspectionNumber: { type: String, required: true, unique: true },
    productId: String,
    productName: { type: String, required: true },
    brand: String,
    category: String,
    manufacturer: String,
    barcode: String,
    batchNumber: String,
    inspectorId: String,
    inspectorName: String,
    status: { type: String, default: 'DRAFT' },
    source: { type: String, default: 'FIELD' },
    images: { type: [ProductImageSchema], default: [] },
    location: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      address: String,
    },
    startedAt: String,
    completedAt: String,
    aiRunId: String,
    aiProvider: String,
    aiModelVersion: String,
    processingTimeMs: Number,
    ruleSetVersion: String,
    rulesEvaluated: { type: Number, default: 0 },
    complianceScore: { type: Number, default: 0 },
    scored: { type: Boolean, default: false },
    confidenceSummary: {
      average: Number,
      min: Number,
      max: Number,
      lowConfidenceCount: Number,
    },
    findings: { type: [FindingSchema], default: [] },
    extractedFields: { type: [ExtractedFieldSchema], default: [] },
    analysisNotes: { type: [String], default: [] },
    reviewStatus: { type: String, default: 'NOT_REQUIRED' },
    reportId: String,
  },
  { timestamps: true }
);

export interface InspectionDoc extends mongoose.Document {
  inspectionNumber: string;
  productId?: string;
  productName: string;
  brand?: string;
  category?: string;
  manufacturer?: string;
  barcode?: string;
  batchNumber?: string;
  inspectorId: string;
  inspectorName: string;
  status: string;
  source: string;
  images: any[];
  location?: any;
  startedAt?: string;
  completedAt?: string;
  aiRunId?: string;
  aiProvider?: string;
  aiModelVersion?: string;
  processingTimeMs?: number;
  ruleSetVersion?: string;
  rulesEvaluated?: number;
  complianceScore: number;
  scored?: boolean;
  confidenceSummary?: any;
  findings: any[];
  extractedFields: any[];
  analysisNotes?: string[];
  reviewStatus: string;
  reportId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const InspectionModel: Model<InspectionDoc> =
  (models.Inspection as Model<InspectionDoc>) || model<InspectionDoc>('Inspection', InspectionSchema);

/* ---------------------------------------------------------------- Product */

const ProductSchema = new Schema(
  {
    name: { type: String, required: true },
    brand: { type: String, default: '' },
    manufacturer: { type: String, default: '' },
    category: { type: String, default: 'OTHER' },
    barcode: { type: String, default: '' },
  },
  { timestamps: true }
);

export interface ProductDoc extends mongoose.Document {
  name: string;
  brand: string;
  manufacturer: string;
  category: string;
  barcode: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ProductModel: Model<ProductDoc> =
  (models.Product as Model<ProductDoc>) || model<ProductDoc>('Product', ProductSchema);

/* ----------------------------------------------------------------- Report */

const ReportSchema = new Schema(
  {
    reportNumber: { type: String, required: true, unique: true },
    inspectionId: { type: String, required: true },
    inspectionNumber: String,
    productName: String,
    status: String,
    complianceScore: Number,
    generatedBy: String,
    generatedByName: String,
    summary: { type: String, default: '' },
  },
  { timestamps: true }
);

export interface ReportDoc extends mongoose.Document {
  reportNumber: string;
  inspectionId: string;
  inspectionNumber: string;
  productName: string;
  status: string;
  complianceScore: number;
  generatedBy: string;
  generatedByName: string;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ReportModel: Model<ReportDoc> =
  (models.Report as Model<ReportDoc>) || model<ReportDoc>('Report', ReportSchema);

/* ------------------------------------------------------------ Rule engine */

const RuleSchema = new Schema(
  {
    ruleCode: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    legalReference: { type: String, default: '' },
    category: { type: String, default: 'GENERAL' },
    applicableProductCategories: { type: [String], default: ['ALL'] },
    requirementType: { type: String, default: 'MANDATORY' },
    validationLogic: { type: Schema.Types.Mixed, required: true },
    severity: { type: String, default: 'MEDIUM' },
    enabled: { type: Boolean, default: true },
    effectiveFrom: String,
    effectiveTo: String,
    version: { type: String, default: '1.0' },
    evidenceRequired: { type: Boolean, default: true },
    reviewRequired: { type: Boolean, default: false },
    createdBy: String,
    updatedBy: String,
    status: { type: String, default: 'DRAFT' },
  },
  { timestamps: true }
);

export interface RuleDoc extends mongoose.Document {
  ruleCode: string;
  title: string;
  description: string;
  legalReference: string;
  category: string;
  applicableProductCategories: string[];
  requirementType: string;
  validationLogic: any;
  severity: string;
  enabled: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  version: string;
  evidenceRequired: boolean;
  reviewRequired: boolean;
  createdBy: string;
  updatedBy: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export const RuleModel: Model<RuleDoc> =
  (models.RegulatoryRule as Model<RuleDoc>) || model<RuleDoc>('RegulatoryRule', RuleSchema);

/* -------------------------------------------------------------- Audit log */

const AuditLogSchema = new Schema(
  {
    timestamp: { type: Date, default: Date.now },
    userId: String,
    userName: String,
    role: String,
    action: String,
    resource: String,
    resourceId: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    ip: String,
    comment: String,
  },
  { timestamps: false }
);

export interface AuditLogDoc extends mongoose.Document {
  timestamp: Date;
  userId: string;
  userName: string;
  role: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValue?: any;
  newValue?: any;
  ip?: string;
  comment?: string;
}

export const AuditLogModel: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) || model<AuditLogDoc>('AuditLog', AuditLogSchema);

/* ------------------------------------------------------- E-commerce store */

const EcommerceListingSchema = new Schema(
  {
    url: String,
    platform: String,
    productName: String,
    brand: String,
    mrp: String,
    netQuantity: String,
    manufacturer: String,
    images: [String],
    extractedAt: String,
    complianceComparison: [Schema.Types.Mixed],
  },
  { timestamps: true }
);

export interface EcommerceListingDoc extends mongoose.Document {
  url: string;
  platform: string;
  productName: string;
  brand?: string;
  mrp?: string;
  netQuantity?: string;
  manufacturer?: string;
  images: string[];
  extractedAt: string;
  complianceComparison?: any[];
  createdAt: Date;
}

export const EcommerceListingModel: Model<EcommerceListingDoc> =
  (models.EcommerceListing as Model<EcommerceListingDoc>) ||
  model<EcommerceListingDoc>('EcommerceListing', EcommerceListingSchema);
