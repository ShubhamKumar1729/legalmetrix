import { Badge } from '@/components/ui/badge';
import { friendlyConfidence, friendlyFinding, friendlySeverity, friendlyStatus } from '@/lib/ui/labels';
import type { FindingStatus, Severity } from '@/types';

/**
 * Badge components that show friendly labels first and keep the official
 * status code available on hover (and inside reports/API for exactness).
 */

const toneVariant = { ok: 'compliant', bad: 'violation', warn: 'review', neutral: 'secondary' } as const;

export function StatusBadge({ status, className }: { status?: string; className?: string }) {
  const f = friendlyStatus(status);
  return (
    <Badge variant={toneVariant[f.tone]} className={className} title={`${f.meaning} (official status: ${status})`}>
      {f.label}
    </Badge>
  );
}

export function FindingBadge({ status, className }: { status?: FindingStatus; className?: string }) {
  const f = friendlyFinding(status);
  return (
    <Badge variant={toneVariant[f.tone]} className={className} title={`${f.meaning} (official: ${status})`}>
      {f.label}
    </Badge>
  );
}

export function SeverityBadge({ severity, className }: { severity?: Severity; className?: string }) {
  const f = friendlySeverity(severity);
  return (
    <Badge variant={toneVariant[f.tone]} className={className} title={`${f.meaning} (official: ${severity})`}>
      {f.label}
    </Badge>
  );
}

export function ConfidenceBadge({ value, className }: { value?: number; className?: string }) {
  const v = value ?? 0;
  const variant = v >= 90 ? 'compliant' : v >= 75 ? 'review' : 'violation';
  return (
    <Badge variant={variant} className={className} title={friendlyConfidence(v)}>
      {v}%
    </Badge>
  );
}
