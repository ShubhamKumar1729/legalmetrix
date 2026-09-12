/**
 * Mongoose models (used only when MongoDB is connected).
 * When MongoDB is unavailable the app falls back to the in-memory store
 * in `src/lib/db/memory-store.ts` — see `connectDB()`.
 */
import mongoose, { Schema, model, models } from 'mongoose';

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    name: { type: String, required: true },
    officialId: { type: String, required: true, unique: true },
    role: {
      type: String,
      required: true,
      enum: ['SUPER_ADMIN', 'REGULATORY_ADMIN', 'ENFORCEMENT_OFFICER', 'REVIEWER', 'ANALYST', 'AUDITOR'],
    },
    department: { type: String, default: '' },
    passwordHash: { type: String, required: true },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

const ImageSchema = new Schema(
  {
    id: String,
    inspectionId: String,
    side: { type: String, enum: ['FRONT', 'BACK', 'SIDE', 'TOP', 'BOTTOM', 'ADDITIONAL'], default: 'FRONT' },
    url: String,
    originalName: String,
    size: Number,
    mimeType: String,
    quality: {
      resolution: Number,
      blurScore: Number,
      brightness: Number,
      readability: Number,
      coverage: Number,
    },
    uploadedAt: String,
  },
  { _id: false }
);

const InspectionSchema = new Schema(
  {
    inspectionId: { type: String, required: true, index: true },
    productId: { type: String, index: true },
    productName: { type: String, required: true },
    brand: String,
    category: String,
    manufacturer: String,
    barcode: String,
    batchNumber: String,
    inspectorId: { type: String, index: true },
    inspectorName: String,
    status: {
      type: String,
      enum: ['DRAFT', 'PROCESSING', 'REVIEW_REQUIRED', 'COMPLIANT', 'NON_COMPLIANT'],
      default: 'DRAFT',
      index: true,
    },
    source: { type: String, enum: ['FIELD', 'ECOMMERCE', 'UPLOAD'], default: 'FIELD' },
    images: [ImageSchema],
    location: Schema.Types.Mixed,
    startedAt: Date,
    completedAt: Date,
    aiRunId: String,
    aiModelMetadata: Schema.Types.Mixed,
    ruleSetVersion: String,
    complianceScore: { type: Number, default: 0 },
    confidenceSummary: Schema.Types.Mixed,
    findings: [Schema.Types.Mixed],
    extractedFields: [Schema.Types.Mixed],
    reviewStatus: {
      type: String,
      enum: ['NOT_REQUIRED', 'PENDING', 'IN_REVIEW', 'COMPLETED'],
      default: 'NOT_REQUIRED',
      index: true,
    },
    reportId: String,
  },
  { timestamps: true }
);

InspectionSchema.index({ productName: 'text', brand: 'text', manufacturer: 'text', inspectionId: 'text' });

const RegulatoryRuleSchema = new Schema(
  {
    ruleCode: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: String,
    legalReference: String,
    category: String,
    applicableProductCategories: { type: [String], default: ['ALL'] },
    requirementType: { type: String, enum: ['MANDATORY', 'CONDITIONAL', 'RECOMMENDED'], default: 'MANDATORY' },
    validationLogic: Schema.Types.Mixed,
    severity: { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'WARNING'], default: 'MEDIUM' },
    enabled: { type: Boolean, default: true },
    effectiveFrom: Date,
    effectiveTo: Date,
    version: { type: String, default: '1.0' },
    evidenceRequired: { type: Boolean, default: true },
    reviewRequired: { type: Boolean, default: false },
    createdBy: String,
    updatedBy: String,
    status: {
      type: String,
      enum: ['DRAFT', 'VALIDATION', 'READY_FOR_APPROVAL', 'APPROVED', 'PUBLISHED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
  },
  { timestamps: true }
);

const AuditLogSchema = new Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    userId: { type: String, index: true },
    userName: String,
    role: String,
    action: { type: String, index: true },
    resource: { type: String, index: true },
    resourceId: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    ip: String,
    comment: String,
  },
  { timestamps: true }
);

export const UserModel = models.User || model('User', UserSchema);
export const InspectionModel = models.Inspection || model('Inspection', InspectionSchema);
export const RegulatoryRuleModel =
  models.RegulatoryRule || model('RegulatoryRule', RegulatoryRuleSchema);
export const AuditLogModel = models.AuditLog || model('AuditLog', AuditLogSchema);
