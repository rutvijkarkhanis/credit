/**
 * Turns a parsed IndiaFilings record into persisted checks, evidence, and
 * flags, then attaches them to a contractor.
 *
 * Two provenance rules are load-bearing here:
 *   - Evidence `observedAt` is the page's snapshot date, never now(). A fact
 *     from a 2023 snapshot is recorded as true in 2023, not today.
 *   - A staleness flag is raised when that snapshot is old, so a reader can see
 *     at a glance that "Active" might no longer hold. This is the freshness
 *     trap made explicit rather than hidden.
 *
 * Data maps onto two existing sources: mca_profile (identity, status,
 * directors, capital) and mca_annual_filings (filing currency). Sources we have
 * no data for — charges, disqualification — are deliberately left unqueried so
 * coverage stays honest.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { checks, contractors, evidence as evidenceTable, flags as flagsTable } from "@/db/schema";
import type { FlagConfidence, FlagSeverity } from "@/lib/sources/types";
import {
  parseIndianDate,
  type ParsedMca,
} from "./indiafilings";

const PROVIDER = "manual:indiafilings";
const STALE_AFTER_DAYS = 365;

type EvidenceDraft = {
  fieldKey: string;
  value: unknown;
  note?: string;
};

type FlagDraft = {
  code: string;
  title: string;
  description: string;
  severity: FlagSeverity;
  confidence: FlagConfidence;
};

function classifyStatus(status: string | undefined): FlagDraft | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("strike") || s.includes("struck")) {
    return {
      code: "MCA_STRUCK_OFF",
      title: "Entity struck off / under strike-off",
      description:
        "MCA records the entity as struck off or in the strike-off process. A struck-off entity has no legal standing to contract.",
      severity: s.includes("under process") ? "high" : "critical",
      confidence: "confirmed",
    };
  }
  if (s.includes("liquidat")) {
    return {
      code: "MCA_UNDER_LIQUIDATION",
      title: "Under liquidation",
      description: "MCA records the entity as under liquidation.",
      severity: "critical",
      confidence: "confirmed",
    };
  }
  if (s.includes("dissolv")) {
    return {
      code: "MCA_DISSOLVED",
      title: "Dissolved",
      description: "MCA records the entity as dissolved.",
      severity: "critical",
      confidence: "confirmed",
    };
  }
  if (s.includes("dormant")) {
    return {
      code: "MCA_DORMANT",
      title: "Dormant status",
      description: "MCA records the entity as dormant — inactive for filing purposes.",
      severity: "medium",
      confidence: "confirmed",
    };
  }
  return null; // Active / Amalgamated / unknown → no adverse status flag
}

export async function attachMcaData(
  contractorId: string,
  parsed: ParsedMca,
  rawText: string,
): Promise<{ profileCheckId: string; filingCheckId: string; flagCount: number }> {
  const observedAt = parseIndianDate(parsed.observedAtRaw) ?? undefined;
  const now = new Date();
  let flagCount = 0;

  // ---- mca_profile check -------------------------------------------------
  const profileEvidence: EvidenceDraft[] = [];
  if (parsed.status)
    profileEvidence.push({ fieldKey: "mca.status", value: parsed.status });
  if (parsed.registrationId)
    profileEvidence.push({
      fieldKey: "mca.registration_id",
      value: parsed.registrationId,
      note: parsed.registrationLabel,
    });
  if (parsed.incorporationDate)
    profileEvidence.push({
      fieldKey: "mca.incorporation_date",
      value: parsed.incorporationDate,
    });
  if (parsed.roc) profileEvidence.push({ fieldKey: "mca.roc", value: parsed.roc });
  if (parsed.registeredAddress)
    profileEvidence.push({
      fieldKey: "mca.registered_address",
      value: parsed.registeredAddress,
    });
  if (parsed.contribution)
    profileEvidence.push({
      fieldKey: "mca.contribution",
      value: parsed.contribution,
    });
  if (parsed.paidUpCapital)
    profileEvidence.push({ fieldKey: "mca.paid_up_capital", value: parsed.paidUpCapital });
  if (parsed.directors.length > 0)
    profileEvidence.push({
      fieldKey: "mca.directors",
      value: parsed.directors,
      note: `${parsed.directors.length} director(s)/partner(s) on record.`,
    });

  const profileFlags: FlagDraft[] = [];
  const statusFlag = classifyStatus(parsed.status);
  if (statusFlag) profileFlags.push(statusFlag);

  // Staleness: not about the entity, about our knowledge of it. Low severity,
  // but visible — it tells the reader the snapshot may no longer hold.
  if (observedAt) {
    const ageDays = (now.getTime() - observedAt.getTime()) / 86_400_000;
    if (ageDays > STALE_AFTER_DAYS) {
      const months = Math.round(ageDays / 30);
      profileFlags.push({
        code: "MCA_DATA_STALE",
        title: "MCA snapshot is out of date",
        description: `This MCA data was last updated roughly ${months} months ago. Current status should be re-verified before relying on it.`,
        severity: "low",
        confidence: "confirmed",
      });
    }
  }

  const profileCheckId = await persistCheck(
    contractorId,
    "mca_profile",
    profileEvidence,
    profileFlags,
    observedAt,
    rawText,
    parsed,
  );
  flagCount += profileFlags.length;

  // ---- mca_annual_filings check -----------------------------------------
  const filingEvidence: EvidenceDraft[] = [];
  if (parsed.lastAnnualReturnFyEnd)
    filingEvidence.push({
      fieldKey: "mca.last_annual_return_fy_end",
      value: parsed.lastAnnualReturnFyEnd,
    });
  if (parsed.lastAccountsFyEnd)
    filingEvidence.push({
      fieldKey: "mca.last_accounts_fy_end",
      value: parsed.lastAccountsFyEnd,
    });

  const filingFlags: FlagDraft[] = [];
  // Conservative lapse check: measured against the snapshot date, not today, so
  // a stale snapshot cannot masquerade as a filing gap. Only flags a clearly
  // overdue position (last filed FY end two or more years before the snapshot).
  const lastReturn = parseIndianDate(parsed.lastAnnualReturnFyEnd);
  if (lastReturn && observedAt) {
    const gapYears =
      (observedAt.getTime() - lastReturn.getTime()) / (365 * 86_400_000);
    if (gapYears >= 2) {
      filingFlags.push({
        code: "MCA_ANNUAL_FILING_OVERDUE",
        title: "Annual filings appear overdue",
        description: `As of the snapshot, the last annual return on record was for FY ending ${parsed.lastAnnualReturnFyEnd} — roughly ${Math.floor(gapYears)} year(s) prior. Persistent non-filing often precedes strike-off.`,
        severity: "medium",
        confidence: "confirmed",
      });
    }
  }

  const filingCheckId = await persistCheck(
    contractorId,
    "mca_annual_filings",
    filingEvidence,
    filingFlags,
    observedAt,
    rawText,
    parsed,
  );
  flagCount += filingFlags.length;

  // ---- backfill contractor identifiers if missing -----------------------
  await backfillContractor(contractorId, parsed);

  return { profileCheckId, filingCheckId, flagCount };
}

async function persistCheck(
  contractorId: string,
  sourceKey: string,
  evidence: EvidenceDraft[],
  flags: FlagDraft[],
  observedAt: Date | undefined,
  rawText: string,
  parsed: ParsedMca,
): Promise<string> {
  const [check] = await db
    .insert(checks)
    .values({
      contractorId,
      sourceKey,
      status: evidence.length > 0 ? "success" : "not_found",
      rawResponse: { source: "indiafilings", text: rawText, parsed } as object,
      provider: PROVIDER,
      completedAt: new Date(),
    })
    .returning({ id: checks.id });

  const evidenceIds: string[] = [];
  for (const ev of evidence) {
    const [row] = await db
      .insert(evidenceTable)
      .values({
        checkId: check.id,
        contractorId,
        sourceKey,
        fieldKey: ev.fieldKey,
        value: ev.value as object,
        // MCA is the registrar's own data — verified — but its age travels with
        // it via observedAt and the staleness flag.
        verificationLevel: "verified",
        observedAt,
        sourceReference: parsed.registrationId
          ? `IndiaFilings · ${parsed.registrationLabel} ${parsed.registrationId}`
          : "IndiaFilings",
        note: ev.note,
      })
      .returning({ id: evidenceTable.id });
    evidenceIds.push(row.id);
  }

  for (const fl of flags) {
    await db.insert(flagsTable).values({
      contractorId,
      checkId: check.id,
      sourceKey,
      code: fl.code,
      title: fl.title,
      description: fl.description,
      severity: fl.severity,
      confidence: fl.confidence,
      evidenceId: evidenceIds[0],
    });
  }

  return check.id;
}

async function backfillContractor(contractorId: string, parsed: ParsedMca) {
  const [c] = await db
    .select()
    .from(contractors)
    .where(eq(contractors.id, contractorId));
  if (!c) return;

  const patch: Partial<typeof contractors.$inferInsert> = {};
  if (!c.cin && parsed.registrationId) patch.cin = parsed.registrationId;
  if (c.entityType === "unknown" && parsed.entityKind === "llp")
    patch.entityType = "llp";
  if (Object.keys(patch).length > 0) {
    patch.updatedAt = new Date();
    await db.update(contractors).set(patch).where(eq(contractors.id, contractorId));
  }
}

/**
 * Removes any prior manual MCA checks for a contractor before a fresh ingest,
 * so re-pasting replaces rather than stacks. Evidence and flags cascade.
 */
export async function clearPriorMcaChecks(contractorId: string) {
  await db
    .delete(checks)
    .where(
      and(
        eq(checks.contractorId, contractorId),
        eq(checks.provider, PROVIDER),
      ),
    );
}
