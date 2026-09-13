export type Role = 'SUPER_ADMIN' | 'REGULATORY_ADMIN' | 'ENFORCEMENT_OFFICER' | 'REVIEWER' | 'ANALYST' | 'AUDITOR';

/** Roles surfaced to ordinary users. The full RBAC matrix stays in the backend. */
export type SimpleRole = 'INSPECTOR' | 'REVIEWER' | 'ADMIN';

export type InspectionStatus = 'DRAFT' | 'PROCESSING' | 'REVIEW_REQUIRED' | 'COMPLIANT' | 'NON_COMPLIANT';
export type ReviewStatus = 'PENDING' | 'AI_CONFIRMED' | 'HUMAN_CONFIRMED' | 'CORRECTED' | 'ESCALATED';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'WARNING';
export type FindingStatus = 'PASS' | 'VIOLATION' | 'WARNING' | 'REVIEW';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

export interface ExtractedField {
  id: string;
  fieldName: string;
  value: string;
  normalizedValue?: string;
  rawText: string;
  language: string;
  script: string;
  confidence: number;
  sourceImageId: string;
  boundingBox: BoundingBox;
  status: FindingStatus;
  editable: boolean;
  reviewStatus: ReviewStatus;
  ruleCode?: string;
  evidenceUrl?: string;
}

export interface Finding {
  id: string;
  inspectionId: string;
  declarationType: string;
  title: string;
  description: string;
  detectedValue?: string;
  expectedValue?: string;
  status: FindingStatus;
  severity: Severity;
  confidence: number;
  ruleId: string;
  ruleCode: string;
  legalReference: string;
  evidence: {
    imageId: string;
    boundingBox: BoundingBox;
    croppedUrl?: string;
  }[];
  reviewStatus: ReviewStatus;
  correctedValue?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewerComment?: string;
  reviewedAt?: string;
  createdAt: string;
}

export type ImageSide = 'FRONT' | 'BACK' | 'SIDE' | 'TOP' | 'BOTTOM' | 'ADDITIONAL';

export interface ProductImage {
  id: string;
  inspectionId: string;
  side: ImageSide;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  /** Where the image came from: a device camera or a file upload. */
  source: 'CAMERA' | 'UPLOAD';
  /**
   * Measured from the actual pixels — never invented.
   * `resolution` is read server-side from the file header; the optional metrics are
   * measured in the browser from the real image before it is uploaded.
   */
  quality: {
    resolution: number;
    brightness?: number;
    blurScore?: number;
    readability?: number;
  };
  uploadedAt: string;
}

export interface Inspection {
  id: string;
  inspectionNumber: string;
  productId?: string;
  productName: string;
  brand: string;
  category: string;
  manufacturer: string;
  barcode?: string;
  batchNumber?: string;
  inspectorId: string;
  inspectorName: string;
  status: InspectionStatus;
  source: 'FIELD' | 'ECOMMERCE' | 'UPLOAD';
  images: ProductImage[];
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
  startedAt: string;
  completedAt?: string;
  aiRunId?: string;
  aiProvider?: string;
  aiModelVersion?: string;
  processingTimeMs?: number;
  ruleSetVersion: string;
  rulesEvaluated: number;
  complianceScore: number;
  /** False when the inspection could not be scored (for example: no rules configured). */
  scored: boolean;
  confidenceSummary: {
    average: number;
    min: number;
    max: number;
    lowConfidenceCount: number;
  };
  findings: Finding[];
  extractedFields: ExtractedField[];
  /** Human-readable notes explaining the analysis outcome. */
  analysisNotes: string[];
  reviewStatus: 'NOT_REQUIRED' | 'PENDING' | 'IN_REVIEW' | 'COMPLETED';
  reportId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  manufacturer: string;
  category: string;
  barcode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  reportNumber: string;
  inspectionId: string;
  inspectionNumber: string;
  productName: string;
  status: InspectionStatus;
  complianceScore: number;
  generatedBy: string;
  generatedByName: string;
  summary: string;
  createdAt: string;
}

export interface RuleCondition {
  field?: string;
  operator?:
    | 'exists'
    | 'not_exists'
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'regex'
    | 'gt'
    | 'lt'
    | 'gte'
    | 'lte'
    | 'in'
    | 'not_in';
  value?: any;
  logic?: 'AND' | 'OR' | 'NOT';
  conditions?: RuleCondition[];
}

export interface RegulatoryRule {
  id: string;
  ruleCode: string;
  title: string;
  description: string;
  legalReference: string;
  category: string;
  applicableProductCategories: string[];
  requirementType: 'MANDATORY' | 'CONDITIONAL' | 'RECOMMENDED';
  validationLogic: RuleCondition;
  severity: Severity;
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  version: string;
  evidenceRequired: boolean;
  reviewRequired: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  status: 'DRAFT' | 'VALIDATION' | 'READY_FOR_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
}

export interface User {
  id: string;
  email: string;
  name: string;
  officialId: string;
  role: Role;
  department?: string;
  active: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: Role;
  action: string;
  resource: string;
  resourceId: string;
  oldValue?: any;
  newValue?: any;
  ip?: string;
  comment?: string;
}

export interface EcommerceListing {
  id: string;
  url: string;
  platform: string;
  productName: string;
  brand?: string;
  mrp?: string;
  netQuantity?: string;
  manufacturer?: string;
  images: string[];
  extractedAt: string;
  complianceComparison?: {
    field: string;
    listingValue: string;
    packageValue: string;
    match: boolean;
    status: FindingStatus;
  }[];
}

export interface DashboardKPIs {
  totalInspections: number;
  compliant: number;
  violations: number;
  reviewRequired: number;
  complianceRate: number;
  avgConfidence: number;
  pendingReviews: number;
  products: number;
  reports: number;
  rulesPublished: number;
}
