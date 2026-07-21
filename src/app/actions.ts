"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contractors } from "@/db/schema";
import { runAssessment } from "@/lib/assessment/engine";
import { intakeSchema } from "@/lib/validation";
import { parseIndiaFilings, type ParsedMca } from "@/lib/sources/manual/indiafilings";
import {
  attachMcaData,
  clearPriorMcaChecks,
} from "@/lib/sources/manual/mca-ingest";
import { parseGst, type ParsedGst } from "@/lib/sources/manual/gst";
import { attachGstData, clearPriorGstChecks } from "@/lib/sources/manual/gst-ingest";

export type IntakeState = { error?: string };

/**
 * Creates a contractor and runs a round-1 (tier-1, cheap) assessment, then
 * redirects to the report. Round 1 is deliberately the only round run at
 * intake — deeper paid sources are a later, gated decision.
 */
export async function createAndAssess(
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const parsed = intakeSchema.safeParse({
    legalName: formData.get("legalName"),
    tradeName: formData.get("tradeName"),
    entityType: formData.get("entityType"),
    gstin: formData.get("gstin"),
    pan: formData.get("pan"),
    state: formData.get("state"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  let contractorId: string;
  try {
    const [row] = await db
      .insert(contractors)
      .values({
        legalName: data.legalName,
        tradeName: data.tradeName,
        entityType: data.entityType,
        gstin: data.gstin?.toUpperCase(),
        pan: data.pan?.toUpperCase(),
        state: data.state,
      })
      .returning({ id: contractors.id });
    contractorId = row.id;
  } catch (err) {
    // Most likely a duplicate GSTIN (unique index).
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("contractors_gstin_idx") || msg.includes("duplicate")) {
      return { error: "A contractor with this GSTIN already exists." };
    }
    return { error: "Could not save contractor. Check the database connection." };
  }

  await runAssessment(contractorId, { tiers: [1] });

  redirect(`/contractors/${contractorId}`);
}

/**
 * Re-runs an assessment round for an existing contractor. Each run writes a new
 * assessment rather than overwriting — history is kept, so a report from last
 * month stays intact and the change over time is visible.
 */
export async function reassess(formData: FormData): Promise<void> {
  const contractorId = String(formData.get("contractorId") ?? "");
  const tier = Number(formData.get("tier") ?? 1);
  if (!contractorId) return;
  await runAssessment(contractorId, { tiers: [tier] });
  revalidatePath(`/contractors/${contractorId}`);
}

// --------------------------------------------------------------------------
// Manual MCA ingest (IndiaFilings paste) — two steps: preview then attach.
// --------------------------------------------------------------------------

export type McaPreviewState = {
  parsed?: ParsedMca;
  rawText?: string;
  error?: string;
};

/**
 * Step 1: parse only. Writes nothing — returns the extracted fields so the user
 * can confirm the parse looks right before any of it is stored. A silent
 * mis-parse into a credit report is exactly the credibility failure to avoid.
 */
export async function previewMca(
  _prev: McaPreviewState,
  formData: FormData,
): Promise<McaPreviewState> {
  const rawText = String(formData.get("rawText") ?? "").trim();
  if (rawText.length < 20) {
    return { error: "Paste the full IndiaFilings company / LLP page text." };
  }
  const parsed = parseIndiaFilings(rawText);
  if (parsed.foundFields.length === 0) {
    return {
      rawText,
      error:
        "Could not recognise any fields. Make sure this is text copied from an IndiaFilings company or LLP page.",
    };
  }
  return { parsed, rawText };
}

/**
 * Step 2: attach the confirmed data and re-run a tier 1+2 assessment so the
 * report reflects it immediately. Re-pasting replaces prior manual MCA data
 * rather than stacking it.
 */
export async function attachMca(formData: FormData): Promise<void> {
  const contractorId = String(formData.get("contractorId") ?? "");
  const rawText = String(formData.get("rawText") ?? "");
  if (!contractorId || !rawText) return;

  const parsed = parseIndiaFilings(rawText);
  await clearPriorMcaChecks(contractorId);
  await attachMcaData(contractorId, parsed, rawText);
  await runAssessment(contractorId, { tiers: [1, 2] });

  redirect(`/contractors/${contractorId}`);
}

// --------------------------------------------------------------------------
// Manual GST ingest (GST portal paste) — same two-step shape as MCA.
// --------------------------------------------------------------------------

export type GstPreviewState = {
  parsed?: ParsedGst;
  rawText?: string;
  error?: string;
};

export async function previewGst(
  _prev: GstPreviewState,
  formData: FormData,
): Promise<GstPreviewState> {
  const rawText = String(formData.get("rawText") ?? "").trim();
  if (rawText.length < 15) {
    return { error: "Paste the GST portal search-result text for this contractor." };
  }
  const parsed = parseGst(rawText);
  if (parsed.foundFields.length === 0) {
    return {
      rawText,
      error:
        "Could not recognise any GST fields. Make sure this is text copied from a GST portal taxpayer page.",
    };
  }
  return { parsed, rawText };
}

export async function attachGst(formData: FormData): Promise<void> {
  const contractorId = String(formData.get("contractorId") ?? "");
  const rawText = String(formData.get("rawText") ?? "");
  if (!contractorId || !rawText) return;

  const parsed = parseGst(rawText);
  await clearPriorGstChecks(contractorId);
  await attachGstData(contractorId, parsed, rawText);
  await runAssessment(contractorId, { tiers: [1, 2] });

  redirect(`/contractors/${contractorId}`);
}
