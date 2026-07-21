/**
 * Persists parsed GST data as checks/evidence/flags and attaches them to a
 * contractor, feeding the gst_profile and gst_filing sources.
 *
 * GST portal data is live, so evidence observedAt is the paste date and there's
 * no staleness flag (unlike MCA). The filing-lapse check is therefore measured
 * against today, which is correct here.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { checks, contractors, evidence as evidenceTable, flags as flagsTable } from "@/db/schema";
import type { FlagConfidence, FlagSeverity } from "@/lib/sources/types";
import { parseIndianDate } from "./indiafilings";
import type { ParsedGst } from "./gst";

const PROVIDER = "manual:gst-portal";
const FILING_LAPSE_DAYS = 120; // ~4 monthly returns missed

type EvidenceDraft = { fieldKey: string; value: unknown; note?: string };
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
  if (s.includes("cancel")) {
    return {
      code: "GST_CANCELLED",
      title: "GST registration cancelled",
      description:
        "The GSTIN is cancelled. A cancelled registration is one of the strongest single adverse signals in the public record.",
      severity: "critical",
      confidence: "confirmed",
    };
  }
  if (s.includes("suspend")) {
    return {
      code: "GST_SUSPENDED",
      title: "GST registration suspended",
      description:
        "The GSTIN is suspended — often a precursor to cancellation and a sign of unresolved compliance issues.",
      severity: "high",
      confidence: "confirmed",
    };
  }
  if (s.includes("inactive")) {
    return {
      code: "GST_INACTIVE",
      title: "GST registration inactive",
      description: "The GSTIN is marked inactive.",
      severity: "high",
      confidence: "confirmed",
    };
  }
  return null; // Active → no adverse status flag
}

export async function attachGstData(
  contractorId: string,
  parsed: ParsedGst,
  rawText: string,
): Promise<{ profileCheckId: string; filingCheckId: string; flagCount: number }> {
  const observedAt = new Date(); // GST portal is live
  let flagCount = 0;

  // ---- gst_profile -------------------------------------------------------
  const profileEvidence: EvidenceDraft[] = [];
  if (parsed.status)
    profileEvidence.push({ fieldKey: "gst.status", value: parsed.status });
  if (parsed.registrationDate)
    profileEvidence.push({
      fieldKey: "gst.registration_date",
      value: parsed.registrationDate,
    });
  if (parsed.constitution)
    profileEvidence.push({ fieldKey: "gst.constitution", value: parsed.constitution });
  if (parsed.taxpayerType)
    profileEvidence.push({ fieldKey: "gst.taxpayer_type", value: parsed.taxpayerType });
  if (parsed.natureOfBusiness)
    profileEvidence.push({
      fieldKey: "gst.nature_of_business",
      value: parsed.natureOfBusiness,
    });
  if (parsed.cancellationDate)
    profileEvidence.push({
      fieldKey: "gst.cancellation_date",
      value: parsed.cancellationDate,
    });

  const profileFlags: FlagDraft[] = [];
  const statusFlag = classifyStatus(parsed.status);
  if (statusFlag) profileFlags.push(statusFlag);

  const profileCheckId = await persistCheck(
    contractorId,
    "gst_profile",
    profileEvidence,
    profileFlags,
    observedAt,
    rawText,
    parsed,
  );
  flagCount += profileFlags.length;

  // ---- gst_filing --------------------------------------------------------
  const filingEvidence: EvidenceDraft[] = [];
  if (parsed.lastFilingDate)
    filingEvidence.push({
      fieldKey: "gst.last_return_filed",
      value: parsed.lastFilingDate,
      note: parsed.lastFilingContext,
    });

  const filingFlags: FlagDraft[] = [];
  const lastFiled = parseIndianDate(parsed.lastFilingDate);
  if (lastFiled) {
    const days = (observedAt.getTime() - lastFiled.getTime()) / 86_400_000;
    if (days > FILING_LAPSE_DAYS) {
      const months = Math.round(days / 30);
      filingFlags.push({
        code: "GST_FILINGS_LAPSED",
        title: "GST returns lapsed",
        description: `No GST return filed for roughly ${months} months (last on ${parsed.lastFilingDate}). Filing gaps commonly precede payment distress.`,
        severity: months >= 6 ? "high" : "medium",
        confidence: "confirmed",
      });
    }
  }

  const filingCheckId = await persistCheck(
    contractorId,
    "gst_filing",
    filingEvidence,
    filingFlags,
    observedAt,
    rawText,
    parsed,
  );
  flagCount += filingFlags.length;

  // Backfill GSTIN onto the contractor if it was blank.
  if (parsed.gstin) {
    const [c] = await db
      .select({ gstin: contractors.gstin })
      .from(contractors)
      .where(eq(contractors.id, contractorId));
    if (c && !c.gstin) {
      await db
        .update(contractors)
        .set({ gstin: parsed.gstin, updatedAt: new Date() })
        .where(eq(contractors.id, contractorId));
    }
  }

  return { profileCheckId, filingCheckId, flagCount };
}

async function persistCheck(
  contractorId: string,
  sourceKey: string,
  evidence: EvidenceDraft[],
  flags: FlagDraft[],
  observedAt: Date,
  rawText: string,
  parsed: ParsedGst,
): Promise<string> {
  const [check] = await db
    .insert(checks)
    .values({
      contractorId,
      sourceKey,
      status: evidence.length > 0 ? "success" : "not_found",
      rawResponse: { source: "gst-portal", text: rawText, parsed } as object,
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
        verificationLevel: "verified",
        observedAt,
        sourceReference: parsed.gstin ? `GST portal · ${parsed.gstin}` : "GST portal",
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

/** Replaces prior manual GST data on re-paste rather than stacking it. */
export async function clearPriorGstChecks(contractorId: string) {
  await db
    .delete(checks)
    .where(
      and(eq(checks.contractorId, contractorId), eq(checks.provider, PROVIDER)),
    );
}
