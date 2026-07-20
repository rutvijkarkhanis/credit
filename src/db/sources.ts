/**
 * The public-source registry.
 *
 * Everything here is queryable without the contractor's consent or
 * participation, which is what makes pre-screening possible. Nothing that
 * requires consent (credit bureau reports, bank statements via Account
 * Aggregator, ITR) belongs in this file — if that changes, it becomes a
 * separate registry with its own consent-capture path.
 *
 * Availability of these portals shifts over time. `isActive` is the kill switch
 * for a source that stops being publicly accessible; seeding is idempotent so
 * flipping it does not require a migration.
 */

type EntityType =
  | "proprietorship"
  | "partnership"
  | "llp"
  | "private_limited"
  | "public_limited"
  | "huf"
  | "trust"
  | "society";

const ALL_ENTITIES: EntityType[] = [
  "proprietorship",
  "partnership",
  "llp",
  "private_limited",
  "public_limited",
  "huf",
  "trust",
  "society",
];

/** Entities with a registrar presence. Proprietorships and unregistered
 *  partnerships have none, which is why MCA-backed sources are N/A for them. */
const REGISTERED_ENTITIES: EntityType[] = [
  "llp",
  "private_limited",
  "public_limited",
];

export type SourceSeed = {
  key: string;
  name: string;
  tier: 1 | 2 | 3;
  description: string;
  applicableEntityTypes: EntityType[];
  requiresIdentifier: "gstin" | "pan" | "cin" | "udyam" | "epfo_code" | "name";
  provider?: string;
  sourceUrl?: string;
  isNameMatched?: boolean;
};

export const SOURCE_REGISTRY: SourceSeed[] = [
  // -------------------------------------------------------------------------
  // Tier 1 — behavioural, current, hard to fake
  // -------------------------------------------------------------------------
  {
    key: "gst_profile",
    name: "GST registration profile",
    tier: 1,
    description:
      "Legal and trade name, registration date, constitution of business, and current status. A cancelled or suspended GSTIN is among the strongest single adverse signals available.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "gstin",
    sourceUrl: "https://www.gst.gov.in",
  },
  {
    key: "gst_filing",
    name: "GST return filing history",
    tier: 1,
    description:
      "GSTR-1 and GSTR-3B filing cadence by period. Monthly behavioural data requiring no consent — a contractor who stops filing is usually in trouble months before a default becomes visible anywhere else.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "gstin",
    sourceUrl: "https://www.gst.gov.in",
  },
  {
    key: "epfo_contributions",
    name: "EPFO establishment contributions",
    tier: 1,
    description:
      "Employee count and month-by-month PF contribution continuity. A business under cash pressure typically stops remitting PF before it stops paying suppliers, making a lapse here an unusually early distress indicator.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "name",
    sourceUrl: "https://www.epfindia.gov.in",
    isNameMatched: true,
  },
  {
    key: "litigation_cheque_bounce",
    name: "Cheque dishonour cases (S.138 NI Act)",
    tier: 1,
    description:
      "District court proceedings under Section 138. The closest public analogue to payment behaviour that exists, and directly relevant to credit. Name matching is ambiguous — results are probable until disambiguated.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "name",
    sourceUrl: "https://ecourts.gov.in",
    isNameMatched: true,
  },
  {
    key: "litigation_recovery",
    name: "Debt recovery and civil suits",
    tier: 1,
    description:
      "DRT proceedings, SARFAESI auction notices and money suits. Establishes existing recovery action by other creditors.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "name",
    isNameMatched: true,
  },
  {
    key: "insolvency_ibbi",
    name: "Insolvency proceedings (IBBI / NCLT)",
    tier: 1,
    description:
      "Corporate debtors under CIRP and liquidation. Definitive when present.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "name",
    sourceUrl: "https://ibbi.gov.in",
    isNameMatched: true,
  },
  {
    key: "suit_filed_defaulters",
    name: "Suit-filed and wilful defaulter lists",
    tier: 1,
    description:
      "Publicly published defaulter lists. Reporting thresholds mean most small contractors will not appear, so absence carries little weight — but presence is decisive.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "name",
    isNameMatched: true,
  },

  // -------------------------------------------------------------------------
  // Tier 2 — structural
  // -------------------------------------------------------------------------
  {
    key: "mca_profile",
    name: "MCA company master data",
    tier: 2,
    description:
      "Incorporation date, paid-up capital, registered address, directors and current status (active, strike-off, under liquidation).",
    applicableEntityTypes: REGISTERED_ENTITIES,
    requiresIdentifier: "cin",
    sourceUrl: "https://www.mca.gov.in",
  },
  {
    key: "mca_charges",
    name: "Registered charges",
    tier: 2,
    description:
      "Charges registered against the entity's assets — how leveraged it already is, to whom, and whether those charges have been satisfied. One of the few public windows onto existing debt.",
    applicableEntityTypes: REGISTERED_ENTITIES,
    requiresIdentifier: "cin",
    sourceUrl: "https://www.mca.gov.in",
  },
  {
    key: "mca_annual_filings",
    name: "Annual filing currency (AOC-4 / MGT-7)",
    tier: 2,
    description:
      "Whether statutory filings are up to date. Persistent non-filing is both a compliance signal and a common precursor to strike-off.",
    applicableEntityTypes: REGISTERED_ENTITIES,
    requiresIdentifier: "cin",
    sourceUrl: "https://www.mca.gov.in",
  },
  {
    key: "director_disqualification",
    name: "Director disqualification list",
    tier: 2,
    description:
      "Directors disqualified under S.164(2). Follows the individual across entities, so it catches a promoter whose previous company failed.",
    applicableEntityTypes: REGISTERED_ENTITIES,
    requiresIdentifier: "cin",
    sourceUrl: "https://www.mca.gov.in",
  },
  {
    key: "udyam_registration",
    name: "Udyam (MSME) registration",
    tier: 2,
    description:
      "Registration validity, date of commencement and declared investment/turnover bracket. Useful vintage corroboration for proprietorships, which have no registrar record.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "udyam",
    sourceUrl: "https://udyamregistration.gov.in",
  },

  // -------------------------------------------------------------------------
  // Tier 3 — pipeline and reputation
  // -------------------------------------------------------------------------
  {
    key: "tender_awards",
    name: "Government tender awards",
    tier: 3,
    description:
      "Contracts awarded via CPPP, GeM and state portals. Public evidence of work pipeline and operating scale — one of the few positive signals available in the public domain.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "name",
    sourceUrl: "https://eprocure.gov.in",
    isNameMatched: true,
  },
  {
    key: "debarment_lists",
    name: "Debarment and blacklist entries",
    tier: 3,
    description:
      "Blacklisting by PSUs, government departments and public bodies. A binary disqualifier when confirmed.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "name",
    isNameMatched: true,
  },
  {
    key: "rera_projects",
    name: "RERA project registrations",
    tier: 3,
    description:
      "Registered projects, delivery status and complaints filed, where the contractor works on real-estate projects.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "name",
    isNameMatched: true,
  },
  {
    key: "credit_rating",
    name: "External credit rating",
    tier: 3,
    description:
      "CRISIL, ICRA, CARE and India Ratings publications. Most small contractors are unrated, but a published rating rationale is unusually rich when one exists.",
    applicableEntityTypes: ALL_ENTITIES,
    requiresIdentifier: "name",
    isNameMatched: true,
  },
];

/**
 * Sources valid for an entity type. This is the denominator in coverage
 * reporting — a proprietorship legitimately has fewer applicable sources than a
 * private limited company, and the report must say so rather than presenting
 * thin coverage as a complete picture.
 */
export function applicableSources(entityType: EntityType): SourceSeed[] {
  return SOURCE_REGISTRY.filter((s) =>
    s.applicableEntityTypes.includes(entityType),
  );
}
