export interface SystemConfig {
  ai: {
    confidenceThresholdHigh: number;
    confidenceThresholdMedium: number;
    reviewThreshold: number;
    enabledModules: string[];
    modelVersion: string;
  };
  compliance: {
    scoringWeights: Record<string, number>;
    severityThresholds: Record<string, number>;
    categories: string[];
  };
  inspection: {
    requiredEvidence: string[];
    minImageQuality: {
      resolution: number;
      blurThreshold: number;
      readabilityThreshold: number;
    };
    maxImages: number;
    allowedFormats: string[];
  };
  system: {
    retentionDays: number;
    notificationsEnabled: boolean;
    reportDefaults: {
      includeEvidence: boolean;
      includeAuditTrail: boolean;
    };
  };
}

export const defaultSystemConfig: SystemConfig = {
  ai: {
    confidenceThresholdHigh: 90,
    confidenceThresholdMedium: 75,
    reviewThreshold: 75,
    enabledModules: [
      'image-quality',
      'ocr',
      'text-region',
      'declaration-detection',
      'entity-extraction',
      'multilingual',
      'mrp-analysis',
      'quantity-analysis',
      'font-analysis',
      'rule-validation',
      'confidence-scoring',
    ],
    modelVersion: process.env.AI_MODEL_VERSION || 'not-configured',
  },
  compliance: {
    scoringWeights: {
      CRITICAL: 25,
      HIGH: 15,
      MEDIUM: 8,
      LOW: 3,
      WARNING: 1,
    },
    severityThresholds: {
      compliant: 80,
      review: 50,
    },
    categories: ['FOOD', 'COSMETICS', 'GROCERY', 'ELECTRONICS', 'TEXTILES', 'OTHER'],
  },
  inspection: {
    requiredEvidence: ['FRONT', 'BACK'],
    minImageQuality: {
      resolution: 320,
      blurThreshold: 0.3,
      readabilityThreshold: 0.7,
    },
    maxImages: 10,
    allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  },
  system: {
    retentionDays: 365,
    notificationsEnabled: true,
    reportDefaults: {
      includeEvidence: true,
      includeAuditTrail: true,
    },
  },
};

/**
 * Runtime configuration. Values are held in memory for the life of the process; swap this
 * for a persisted store when multi-instance deployments are needed.
 */
let currentConfig: SystemConfig = { ...defaultSystemConfig };

export function getSystemConfig(): SystemConfig {
  return currentConfig;
}

export function updateSystemConfig(updates: Partial<SystemConfig>): SystemConfig {
  currentConfig = {
    ...currentConfig,
    ...updates,
    ai: { ...currentConfig.ai, ...(updates.ai || {}) },
    compliance: { ...currentConfig.compliance, ...(updates.compliance || {}) },
    inspection: { ...currentConfig.inspection, ...(updates.inspection || {}) },
    system: { ...currentConfig.system, ...(updates.system || {}) },
  };
  return currentConfig;
}
