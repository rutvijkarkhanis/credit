"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contractors } from "@/db/schema";
import { runAssessment } from "@/lib/assessment/engine";
import { intakeSchema } from "@/lib/validation";

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
