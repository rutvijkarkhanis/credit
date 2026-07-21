/**
 * Runs an assessment round for a contractor and persists everything with its
 * provenance intact.
 *
 * Flow for one round:
 *   1. Pick sources that are active AND applicable to the entity type AND in
 *      the requested tier(s). Applicability is the coverage denominator — a
 *      proprietorship legitimately has fewer than a company, and the report
 *      says so instead of hiding it.
 *   2. Run each source's adapter (skipping sources with no adapter yet).
 *   3. Persist a check per source, the evidence and flags it produced, then an
 *      assessment whose verdict/score follow from those flags.
 *
 * Rounds are additive and cheap-first: round 1 is tier 1 only, so the expensive
 * paid sources never run on a contractor the free round already rejected.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  assessments,
  assessmentChecks,
  checks,
  contractors,
  evidence as evidenceTable,
  flags as flagsTable,
  sources,
} from "@/db/schema";
import { getAdapter } from "@/lib/sources/adapters";
import type {
  ContractorIdentifiers,
  EntityType,
  VerificationLevel,
} from "@/lib/sources/types";
import {
  METHODOLOGY_VERSION,
  deriveScore,
  deriveVerdict,
  summarize,
  type Verdict,
  type VerdictFlag,
} from "./methodology";

export type AssessmentResult = {
  assessmentId: string;
  verdict: Verdict;
  score: number | null;
  coverageChecked: number;
  coverageApplicable: number;
  flagCount: number;
};

export async function runAssessment(
  contractorId: string,
  opts: { tiers?: number[]; generatedBy?: string } = {},
): Promise<AssessmentResult> {
  const tiers = opts.tiers ?? [1];

  const [contractor] = await db
    .select()
    .from(contractors)
    .where(eq(contractors.id, contractorId));
  if (!contractor) throw new Error(`Contractor ${contractorId} not found`);

  const identifiers: ContractorIdentifiers = {
    id: contractor.id,
    legalName: contractor.legalName,
    tradeName: contractor.tradeName,
    entityType: contractor.entityType as EntityType,
    gstin: contractor.gstin,
    pan: contractor.pan,
    cin: contractor.cin,
    udyamNumber: contractor.udyamNumber,
    epfoCode: contractor.epfoCode,
    state: contractor.state,
  };

  // Applicable = active sources in the requested tiers that apply to this
  // entity type. This is the coverage denominator.
  const candidateSources = await db
    .select()
    .from(sources)
    .where(and(eq(sources.isActive, true), inArray(sources.tier, tiers)));

  const applicable = candidateSources.filter((s) =>
    s.applicableEntityTypes.includes(identifiers.entityType),
  );
  const coverageApplicable = applicable.length;

  const collectedFlags: VerdictFlag[] = [];
  const checkIdsForAssessment: string[] = [];
  let coverageChecked = 0;

  for (const source of applicable) {
    const adapter = getAdapter(source.key);
    if (!adapter) continue; // no implementation yet → left unqueried, honestly

    let outcome;
    try {
      outcome = await adapter.run(identifiers);
    } catch (err) {
      outcome = {
        status: "error" as const,
        raw: null,
        provider: "unknown",
        errorMessage: err instanceof Error ? err.message : String(err),
        evidence: [],
        flags: [],
      };
    }

    const [check] = await db
      .insert(checks)
      .values({
        contractorId,
        sourceKey: source.key,
        status: outcome.status,
        rawResponse: outcome.raw as object,
        provider: outcome.provider,
        errorMessage: outcome.errorMessage,
        completedAt: new Date(),
      })
      .returning({ id: checks.id });

    checkIdsForAssessment.push(check.id);

    // A source counts toward coverage only if it actually returned an answer.
    // not_applicable and error do not — thin coverage must stay visible.
    if (outcome.status === "success" || outcome.status === "not_found") {
      coverageChecked += 1;
    }

    // Evidence first, so flags can point at the row they were raised from.
    const insertedEvidenceIds: string[] = [];
    for (const ev of outcome.evidence) {
      const [row] = await db
        .insert(evidenceTable)
        .values({
          checkId: check.id,
          contractorId,
          sourceKey: source.key,
          fieldKey: ev.fieldKey,
          value: ev.value as object,
          verificationLevel: ev.verificationLevel as VerificationLevel,
          observedAt: ev.observedAt,
          sourceReference: ev.sourceReference,
          note: ev.note,
        })
        .returning({ id: evidenceTable.id });
      insertedEvidenceIds.push(row.id);
    }

    for (const fl of outcome.flags) {
      const evidenceId =
        fl.evidenceIndex !== undefined
          ? insertedEvidenceIds[fl.evidenceIndex]
          : undefined;
      await db.insert(flagsTable).values({
        contractorId,
        checkId: check.id,
        sourceKey: source.key,
        code: fl.code,
        title: fl.title,
        description: fl.description,
        severity: fl.severity,
        confidence: fl.confidence,
        evidenceId,
      });
      collectedFlags.push({ severity: fl.severity, confidence: fl.confidence });
    }
  }

  const verdict = deriveVerdict(collectedFlags, coverageChecked);
  const score = deriveScore(collectedFlags, coverageChecked);
  const summary = summarize(
    verdict,
    coverageChecked,
    coverageApplicable,
    collectedFlags.length,
  );

  const [assessment] = await db
    .insert(assessments)
    .values({
      contractorId,
      verdict,
      coverageChecked,
      coverageApplicable,
      score,
      summary,
      methodologyVersion: METHODOLOGY_VERSION,
      generatedBy: opts.generatedBy,
    })
    .returning({ id: assessments.id });

  if (checkIdsForAssessment.length > 0) {
    await db.insert(assessmentChecks).values(
      checkIdsForAssessment.map((checkId) => ({
        assessmentId: assessment.id,
        checkId,
      })),
    );
  }

  return {
    assessmentId: assessment.id,
    verdict,
    score,
    coverageChecked,
    coverageApplicable,
    flagCount: collectedFlags.length,
  };
}
