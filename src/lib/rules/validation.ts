import { z } from 'zod';

/** Validation for rule create/update payloads. */
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'WARNING'] as const;
const OPERATORS = [
  'exists','not_exists','equals','not_equals','contains','regex','gt','lt','gte','lte','in','not_in',
] as const;

const conditionSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({
      field: z.string().min(1),
      operator: z.enum(OPERATORS),
      value: z.any().optional(),
    }),
    z.object({
      logic: z.enum(['AND', 'OR', 'NOT']),
      conditions: z.array(conditionSchema).min(1),
    }),
  ])
);

export const ruleInputSchema = z.object({
  ruleCode: z.string().min(2, 'Rule code is required'),
  title: z.string().min(3, 'Title is required'),
  description: z.string().default(''),
  legalReference: z.string().default(''),
  category: z.string().min(1, 'Category is required'),
  applicableProductCategories: z.array(z.string()).default(['ALL']),
  requirementType: z.enum(['MANDATORY', 'CONDITIONAL', 'RECOMMENDED']).default('MANDATORY'),
  validationLogic: conditionSchema,
  severity: z.enum(SEVERITIES).default('MEDIUM'),
  enabled: z.boolean().default(true),
  effectiveFrom: z.string().default(() => new Date().toISOString().slice(0, 10)),
  effectiveTo: z.string().optional(),
  version: z.string().default('1.0'),
  evidenceRequired: z.boolean().default(true),
  reviewRequired: z.boolean().default(false),
  status: z
    .enum(['DRAFT', 'VALIDATION', 'READY_FOR_APPROVAL', 'APPROVED', 'PUBLISHED', 'ARCHIVED'])
    .default('DRAFT'),
});
