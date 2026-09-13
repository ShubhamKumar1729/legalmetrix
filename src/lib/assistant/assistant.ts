/**
 * Compliance assistant.
 *
 * There is no language model behind this. It is a deterministic lookup over records
 * that already exist in the database, so it cannot invent a fact: every answer is
 * assembled from stored fields, and anything it cannot find produces an explicit
 * "I don't have that" response rather than a guess.
 *
 * If a real assistant model is connected later, it replaces `answerQuestion` and
 * inherits the same context object — the honesty contract does not change.
 */

import type { Finding, Inspection, RegulatoryRule } from '@/types';

export interface AssistantContext {
  /** Null when no inspection is selected. */
  inspection: Inspection | null;
  /** Rules published for the active rule set. */
  rules: RegulatoryRule[];
}

export interface AssistantReply {
  answer: string;
  /** Which stored records the answer was built from. Empty when nothing was found. */
  groundedIn: string[];
  /** False when the question could not be answered from stored data. */
  answered: boolean;
}

/** Shown when nothing is selected, so the officer is asked rather than guessed at. */
export const NOTHING_SELECTED_PROMPT = 'Which inspection would you like me to look at?';

const FINDING_LABEL: Record<string, string> = {
  PASS: 'passed',
  VIOLATION: 'failed',
  REVIEW: 'needs review',
  WARNING: 'raised a warning',
};

function listFindings(findings: Finding[], statuses: string[]) {
  return findings.filter((finding) => statuses.includes(finding.status));
}

function describeFinding(finding: Finding) {
  const outcome = FINDING_LABEL[finding.status] || finding.status.toLowerCase();
  const rule = finding.legalReference ? `${finding.ruleCode} (${finding.legalReference})` : finding.ruleCode;
  const detected = finding.detectedValue ? ` Detected: ${finding.detectedValue}.` : '';
  const corrected = finding.correctedValue ? ` A reviewer corrected this to: ${finding.correctedValue}.` : '';
  return `• ${finding.title} ${outcome} — rule ${rule}. Confidence ${finding.confidence}%.${detected}${corrected}`;
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

/**
 * Answers from stored data only. The order of the checks matters: more specific
 * questions are matched before the general ones.
 */
export function answerQuestion(question: string, context: AssistantContext): AssistantReply {
  const asked = question.trim().toLowerCase();
  if (!asked) {
    return { answer: 'Ask me about this inspection — what failed, what needs review, or which rule applies.', groundedIn: [], answered: false };
  }

  const { inspection, rules } = context;

  if (!inspection) {
    return {
      answer: NOTHING_SELECTED_PROMPT,
      groundedIn: [],
      answered: false,
    };
  }

  const id = inspection.inspectionNumber;

  if (includesAny(asked, ['violation', 'fail', 'non-complian', 'noncomplian', 'wrong', 'breach'])) {
    const failed = listFindings(inspection.findings, ['VIOLATION']);
    if (failed.length === 0) {
      const pending = listFindings(inspection.findings, ['REVIEW']);
      if (pending.length > 0) {
        return {
          answer: `No confirmed violations are recorded for ${id} yet. ${pending.length} finding(s) are still awaiting review, so the outcome could still change.`,
          groundedIn: [id],
          answered: true,
        };
      }
      return {
        answer: `No violations are recorded for ${id}.`,
        groundedIn: [id],
        answered: true,
      };
    }
    return {
      answer: `${id} has ${failed.length} confirmed violation(s):\n${failed.map(describeFinding).join('\n')}`,
      groundedIn: [id, ...failed.map((finding) => finding.ruleCode)],
      answered: true,
    };
  }

  if (includesAny(asked, ['who', 'inspector', 'reviewer', 'officer'])) {
    const reviewers = Array.from(
      new Set(inspection.findings.map((finding) => finding.reviewerName).filter((name): name is string => Boolean(name)))
    );
    const reviewed = reviewers.length > 0 ? ` Reviewed by ${reviewers.join(', ')}.` : ' No reviewer has acted on it yet.';
    return {
      answer: `${id} was inspected by ${inspection.inspectorName}.${reviewed}`,
      groundedIn: [id],
      answered: true,
    };
  }

  if (includesAny(asked, ['review', 'confirm', 'pending', 'uncertain', 'human'])) {
    const pending = inspection.findings.filter((finding) => finding.reviewStatus === 'PENDING');
    if (pending.length === 0) {
      return {
        answer: `Nothing on ${id} is awaiting review. Every finding has been decided.`,
        groundedIn: [id],
        answered: true,
      };
    }
    return {
      answer: `${pending.length} finding(s) on ${id} need a decision:\n${pending.map(describeFinding).join('\n')}`,
      groundedIn: [id],
      answered: true,
    };
  }

  if (includesAny(asked, ['score', 'compliance rate', 'percent', 'how compliant', 'result', 'outcome', 'status'])) {
    if (!inspection.scored) {
      const note = inspection.analysisNotes?.[0];
      return {
        answer: `${id} has no compliance score.${note ? ` ${note}` : ' It could not be scored from the available data.'}`,
        groundedIn: [id],
        answered: true,
      };
    }
    return {
      answer: `${id} scored ${inspection.complianceScore}/100 across ${inspection.rulesEvaluated} evaluated rule(s). Recorded status: ${inspection.status.replace(/_/g, ' ').toLowerCase()}.`,
      groundedIn: [id],
      answered: true,
    };
  }

  if (includesAny(asked, ['rule', 'regulation', 'legal', 'law', 'section', 'clause'])) {
    const codes = Array.from(new Set(inspection.findings.map((finding) => finding.ruleCode)));
    if (codes.length === 0) {
      return {
        answer: `No rules were evaluated for ${id}.${rules.length === 0 ? ' No rules are published yet.' : ''}`,
        groundedIn: [id],
        answered: true,
      };
    }
    const lines = codes.map((code) => {
      const rule = rules.find((candidate) => candidate.ruleCode === code);
      const finding = inspection.findings.find((candidate) => candidate.ruleCode === code);
      const reference = rule?.legalReference || finding?.legalReference || 'no reference recorded';
      return `• ${code} — ${reference}${rule ? ` — ${rule.severity.toLowerCase()} severity, ${rule.status.toLowerCase()}` : ''}`;
    });
    return {
      answer: `${codes.length} rule(s) were applied to ${id}:\n${lines.join('\n')}`,
      groundedIn: [id, ...codes],
      answered: true,
    };
  }

  if (includesAny(asked, ['image', 'photo', 'picture', 'evidence', 'captured'])) {
    const count = inspection.images?.length || 0;
    if (count === 0) {
      return { answer: `${id} has no images attached.`, groundedIn: [id], answered: true };
    }
    const sides = inspection.images.map((image) => `${image.side.toLowerCase()} (${image.source.toLowerCase()})`);
    return {
      answer: `${id} has ${count} image(s): ${sides.join(', ')}.`,
      groundedIn: [id],
      answered: true,
    };
  }

  if (includesAny(asked, ['product', 'brand', 'manufacturer', 'barcode', 'batch', 'category'])) {
    const details = [
      `Product: ${inspection.productName}`,
      inspection.brand ? `Brand: ${inspection.brand}` : 'Brand: not recorded',
      `Category: ${inspection.category}`,
      `Manufacturer: ${inspection.manufacturer}`,
      inspection.barcode ? `Barcode: ${inspection.barcode}` : null,
      inspection.batchNumber ? `Batch: ${inspection.batchNumber}` : null,
    ].filter((line): line is string => Boolean(line));
    return { answer: details.join('\n'), groundedIn: [id], answered: true };
  }

  if (includesAny(asked, ['model', 'ai', 'provider', 'vision', 'ocr', 'extracted'])) {
    if (!inspection.aiProvider) {
      return {
        answer: `No AI run is recorded for ${id}.`,
        groundedIn: [id],
        answered: true,
      };
    }
    const extracted = inspection.extractedFields?.length || 0;
    return {
      answer: `${id} was analyzed by "${inspection.aiProvider}"${inspection.aiModelVersion ? ` version ${inspection.aiModelVersion}` : ''}. It produced ${extracted} extracted field(s) in ${inspection.processingTimeMs ?? 0} ms.`,
      groundedIn: [id],
      answered: true,
    };
  }

  return {
    answer:
      `I can only answer from what is stored for ${id}. I have its outcome, findings, rules applied, images, product details and who reviewed it — but nothing about "${question.trim()}". Open the inspection to see the full record.`,
    groundedIn: [id],
    answered: false,
  };
}
