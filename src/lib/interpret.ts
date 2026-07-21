/**
 * Turns raw evidence and flags into plain-language sentiment for the report, so
 * a non-technical reader (or a vendor) can read it without knowing what
 * "mca.status" or "not_found" means.
 *
 * Deliberately kept simple and rule-based: each field maps to one of four tones
 * and a one-line explanation. It reads the value where the meaning depends on
 * it (a status of "Active" is good, "Cancelled" is bad) and otherwise falls
 * back to a neutral fact.
 */

export type Tone = "good" | "bad" | "check" | "info";

const BAD_STATUS =
  /cancel|suspend|strike|struck|liquidat|dissolv|inactive|dormant/;

export function interpretEvidence(
  fieldKey: string,
  value: unknown,
): { tone: Tone; plain: string } {
  const str = typeof value === "string" ? value.toLowerCase() : "";

  // "Nothing found" results (litigation, insolvency, debarment) are reassuring.
  if (
    value &&
    typeof value === "object" &&
    "found" in (value as Record<string, unknown>) &&
    (value as Record<string, unknown>).found === false
  ) {
    return { tone: "good", plain: "Nothing negative found here — a reassuring sign." };
  }

  if (/\.status$/.test(fieldKey)) {
    if (BAD_STATUS.test(str))
      return {
        tone: "bad",
        plain: "This registration is not in good standing — a serious warning.",
      };
    if (str.includes("active"))
      return {
        tone: "good",
        plain: "Registered and active — legally in good standing.",
      };
    return { tone: "info", plain: "Their current registration status." };
  }

  if (fieldKey.includes("active_members"))
    return {
      tone: "good",
      plain: "A real, operating business with staff on the payroll.",
    };

  if (
    fieldKey.includes("last_return") ||
    fieldKey.includes("last_annual_return") ||
    fieldKey.includes("last_accounts") ||
    fieldKey.includes("months_since")
  )
    return {
      tone: "check",
      plain: "How recently they filed — the more recent, the better. Check the date.",
    };

  if (fieldKey.includes("taxpayer_type"))
    return str.includes("regular")
      ? { tone: "good", plain: "A regular taxpayer — the normal, healthy type." }
      : { tone: "info", plain: "The kind of taxpayer they are." };

  if (fieldKey.includes("nature_of_business"))
    return { tone: "good", plain: "Confirms the work they actually do." };

  if (fieldKey.includes("cancellation_date"))
    return {
      tone: "bad",
      plain: "A cancellation date is on record — the registration was ended.",
    };

  if (fieldKey.includes("incorporation") || fieldKey.includes("registration_date"))
    return { tone: "info", plain: "When the business started." };

  if (fieldKey.includes("contribution") || fieldKey.includes("capital"))
    return {
      tone: "info",
      plain: "Capital the owners put in — very small figures are worth noting.",
    };

  if (fieldKey.includes("directors"))
    return { tone: "info", plain: "The people who run the business." };

  return { tone: "info", plain: "Background detail." };
}

/** A finding is a concern by definition; only its weight varies. */
export function flagTone(severity: string): Tone {
  if (severity === "low" || severity === "info") return "check";
  return "bad";
}

/** Friendlier value display — names instead of JSON, "None found" for misses. */
export function formatEvidenceValue(fieldKey: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.found === false) return "None found";
    if (fieldKey.includes("directors") && Array.isArray(value)) {
      return (value as Array<{ name?: string }>)
        .map((d) => d.name ?? "")
        .filter(Boolean)
        .join(", ");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
