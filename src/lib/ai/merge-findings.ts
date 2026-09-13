import type { Finding } from '@/types';

/**
 * Combines the rule engine's decisions with whatever the vision model reported.
 *
 * The rule engine owns the compliance decision for every configured rule. When a real
 * model returns a finding for the same rule, its detected value, evidence and confidence
 * are used; when the model is confident, its status is trusted too. Findings reported by
 * the model that do not map to a configured rule are appended so nothing is lost.
 */
export function mergeFindings(
  ruleFindings: Finding[],
  modelFindings: Finding[],
  confidenceThreshold: number
): Finding[] {
  if (!modelFindings || modelFindings.length === 0) return ruleFindings;

  const unmatched = new Map(modelFindings.map((finding) => [finding.ruleCode, finding]));

  const merged = ruleFindings.map((ruleFinding) => {
    const model = unmatched.get(ruleFinding.ruleCode);
    if (!model) return ruleFinding;
    unmatched.delete(ruleFinding.ruleCode);

    const confident = (model.confidence ?? 0) >= confidenceThreshold;

    return {
      ...ruleFinding,
      detectedValue: model.detectedValue ?? ruleFinding.detectedValue,
      description: model.description || ruleFinding.description,
      confidence: model.confidence ?? ruleFinding.confidence,
      evidence: model.evidence?.length ? model.evidence : ruleFinding.evidence,
      status: confident ? model.status : ruleFinding.status,
      reviewStatus: confident && model.status === 'PASS' ? 'AI_CONFIRMED' : ruleFinding.reviewStatus,
    };
  });

  return [...merged, ...Array.from(unmatched.values())];
}
