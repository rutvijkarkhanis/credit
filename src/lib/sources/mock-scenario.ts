/**
 * Deterministic scenario derivation for the mock adapters.
 *
 * Two goals. First, the same contractor always produces the same result, so a
 * generated report is stable and re-runnable — important while there is no real
 * data behind it. Second, specific inputs deterministically trigger specific
 * adverse cases, so a clean contractor and a risky one can both be demonstrated
 * on demand rather than hoping the hash lands somewhere useful.
 *
 * None of this ships to production. When a real aggregator is wired in, the
 * adapters call it instead and this file is deleted.
 */

/** Stable non-negative hash of a string in [0, 100). */
export function stableBucket(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100;
}

/**
 * Explicit demo triggers, checked against legal name (case-insensitive). These
 * make a demo scriptable: name a test contractor "Adverse Test Constructions"
 * and it reliably comes back adverse.
 */
export function nameSignals(legalName: string) {
  const n = legalName.toLowerCase();
  return {
    forceGstCancelled: n.includes("cancelled") || n.includes("adverse"),
    forceFilingLapsed: n.includes("lapsed") || n.includes("adverse"),
    forceChequeCase: n.includes("bounce") || n.includes("adverse"),
    forceInsolvency: n.includes("insolven"),
    forceDebarred: n.includes("blacklist") || n.includes("debar"),
    /** Simulates a noisy court hit that is only a probable name match. */
    forceProbableMatch: n.includes("probable") || n.includes("kumar"),
  };
}

/** Months since last GST return, derived from the GSTIN so it is stable. */
export function derivedFilingLapseMonths(gstin: string): number {
  const b = stableBucket(gstin + ":filing");
  // Most contractors file on time; a minority drift. Skewed toward current.
  if (b < 70) return 0;
  if (b < 85) return 1;
  if (b < 93) return 2;
  if (b < 97) return 4;
  return 7;
}

/** Derived active-employee headcount for the EPFO mock. */
export function derivedHeadcount(seed: string): number {
  const b = stableBucket(seed + ":epfo");
  return 4 + (b % 40);
}
