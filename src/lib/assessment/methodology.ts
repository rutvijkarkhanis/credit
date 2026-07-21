/**
 * The scoring and verdict rules, kept apart from the orchestration that applies
 * them so the methodology can be read, reviewed, and versioned on its own.
 *
 * Design stance, restated because the code encodes it: public data can prove a
 * contractor is risky but cannot prove one is safe. So the verdict leads and a
 * numeric score is secondary — and omitted entirely when coverage is too thin
 * to mean anything.
 */

import type { FlagConfidence, FlagSeverity } from "../sources/types";

/**
 * Pinned onto every assessment. Bump when weights or rules change so historical
 * reports stay interpretable against the rules that actually produced them.
 */
export const METHODOLOGY_VERSION = "0.1.0-mock";

/**
 * Minimum sources that must return an answer before a verdict other than
 * `insufficient_data` is credible. Below this the report says so rather than
 * dressing up thin coverage as a clean bill.
 */
export const MIN_COVERAGE_FOR_VERDICT = 3;

export type Verdict = "clear" | "caution" | "adverse" | "insufficient_data";

export type VerdictFlag = {
  severity: FlagSeverity;
  confidence: FlagConfidence;
};

const isSevere = (s: FlagSeverity) => s === "critical" || s === "high";

/**
 * The core decision.
 *
 * - A *confirmed* severe flag is decisive: adverse.
 * - A *probable* severe flag, or a confirmed medium one, is caution — enough to
 *   warrant a human look, not enough to condemn. This is exactly where a
 *   name-matched court hit lands, and why confidence is kept separate from
 *   severity.
 * - Too little coverage is its own honest outcome.
 * - Otherwise: clear — meaning "no adverse signal found", never "safe".
 */
export function deriveVerdict(
  flags: VerdictFlag[],
  coverageChecked: number,
): Verdict {
  const confirmedSevere = flags.some(
    (f) => f.confidence === "confirmed" && isSevere(f.severity),
  );
  if (confirmedSevere) return "adverse";

  if (coverageChecked < MIN_COVERAGE_FOR_VERDICT) return "insufficient_data";

  const cautionWorthy = flags.some(
    (f) =>
      (f.confidence !== "confirmed" && isSevere(f.severity)) ||
      (f.confidence === "confirmed" && f.severity === "medium"),
  );
  if (cautionWorthy) return "caution";

  return "clear";
}

const SEVERITY_PENALTY: Record<FlagSeverity, number> = {
  critical: 100,
  high: 45,
  medium: 20,
  low: 8,
  info: 0,
};

const CONFIDENCE_WEIGHT: Record<FlagConfidence, number> = {
  confirmed: 1,
  probable: 0.5,
  unconfirmed: 0.25,
};

/**
 * A 0–100 summary of adverse findings, not a prediction. Starts at 100 and
 * deducts per flag, weighted down by confidence so a probable match dents the
 * number without sinking it. Returns null below the coverage floor — a missing
 * score is more honest than a confident one built on nothing.
 */
export function deriveScore(
  flags: VerdictFlag[],
  coverageChecked: number,
): number | null {
  if (coverageChecked < MIN_COVERAGE_FOR_VERDICT) return null;
  const penalty = flags.reduce(
    (sum, f) =>
      sum + SEVERITY_PENALTY[f.severity] * CONFIDENCE_WEIGHT[f.confidence],
    0,
  );
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function summarize(
  verdict: Verdict,
  coverageChecked: number,
  coverageApplicable: number,
  flagCount: number,
): string {
  const cov = `Checked ${coverageChecked} of ${coverageApplicable} applicable source(s).`;
  switch (verdict) {
    case "adverse":
      return `${cov} Confirmed adverse finding(s) present — decline or escalate.`;
    case "caution":
      return `${cov} ${flagCount} finding(s) warrant review before extending terms.`;
    case "insufficient_data":
      return `${cov} Too few sources returned to support a verdict.`;
    case "clear":
      return `${cov} No adverse signals found. Absence of red flags is not proof of payment discipline.`;
  }
}
