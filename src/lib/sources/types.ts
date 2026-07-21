/**
 * Adapter contract for a public source.
 *
 * An adapter is the only thing that knows how to talk to a given source and how
 * to turn its response into the two things the assessment cares about: evidence
 * (individual provenanced claims) and flags (adverse findings). Everything above
 * this layer is source-agnostic, which is what lets the mock adapters here be
 * swapped for real aggregator-backed ones without the engine changing.
 */

export type EntityType =
  | "proprietorship"
  | "partnership"
  | "llp"
  | "private_limited"
  | "public_limited"
  | "huf"
  | "trust"
  | "society"
  | "unknown";

/** What an adapter is given to run its lookup. */
export type ContractorIdentifiers = {
  id: string;
  legalName: string;
  tradeName: string | null;
  entityType: EntityType;
  gstin: string | null;
  pan: string | null;
  cin: string | null;
  udyamNumber: string | null;
  epfoCode: string | null;
  state: string | null;
};

export type VerificationLevel = "verified" | "probable" | "stated" | "unavailable";
export type FlagSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FlagConfidence = "confirmed" | "probable" | "unconfirmed";

export type EvidenceInput = {
  fieldKey: string;
  value: unknown;
  verificationLevel: VerificationLevel;
  observedAt?: Date;
  sourceReference?: string;
  note?: string;
};

export type FlagInput = {
  code: string;
  title: string;
  description?: string;
  severity: FlagSeverity;
  /**
   * Kept independent of severity on purpose. A name-matched source can raise a
   * high-severity flag at `probable` confidence; the engine must never let that
   * alone force an adverse verdict.
   */
  confidence: FlagConfidence;
  /** Index into the outcome's evidence array this flag was raised from. */
  evidenceIndex?: number;
};

/** Mirrors check_status, minus the states the engine assigns itself. */
export type CheckStatus =
  | "success"
  | "not_applicable"
  | "not_found"
  | "error";

export type CheckOutcome = {
  status: CheckStatus;
  /** The unmodified payload the source returned — retained on the check row. */
  raw: unknown;
  provider: string;
  /** When the source observed this, if it differs from when we asked. */
  observedAt?: Date;
  errorMessage?: string;
  evidence: EvidenceInput[];
  flags: FlagInput[];
};

export interface SourceAdapter {
  /** Must match a `sources.key` in the registry. */
  key: string;
  run(input: ContractorIdentifiers): Promise<CheckOutcome>;
}
