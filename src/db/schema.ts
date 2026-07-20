import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Core principle of this schema: no claim exists without its provenance.
 *
 * Every assertion the system makes about a contractor is an `evidence` row that
 * points back to the `check` that produced it, and every check retains the raw
 * payload the source returned. A report is never a set of free-floating facts —
 * it is a view over evidence, each item carrying where it came from, when it was
 * observed, and how strongly it is established.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Entity type drives source applicability. This matters more than it looks:
 * most small contractors are proprietorships, which have no MCA/ROC presence at
 * all, so several sources are permanently N/A for them. Coverage reporting
 * depends on knowing that up front rather than treating a miss as a failure.
 */
export const entityTypeEnum = pgEnum("entity_type", [
  "proprietorship",
  "partnership",
  "llp",
  "private_limited",
  "public_limited",
  "huf",
  "trust",
  "society",
  "unknown",
]);

/** Which identifier a source needs in order to be queryable at all. */
export const identifierKindEnum = pgEnum("identifier_kind", [
  "gstin",
  "pan",
  "cin",
  "udyam",
  "epfo_code",
  "name",
]);

export const checkStatusEnum = pgEnum("check_status", [
  "pending",
  "success",
  /** Source does not apply to this entity type — not a failure. */
  "not_applicable",
  /** Source was queried successfully but holds no record for this entity. */
  "not_found",
  "error",
]);

/**
 * How strongly a single piece of evidence is established.
 *
 * `probable` exists specifically for noisy name-matched sources — court records
 * in particular, where "Kumar Constructions" matches many unrelated entities.
 * Probable evidence must never drive an automatic adverse verdict on its own;
 * it surfaces for human disambiguation.
 *
 * `stated` is anything the contractor asserted that no public source confirms.
 * It is retained and reported, but always visibly labelled as unverified.
 */
export const verificationLevelEnum = pgEnum("verification_level", [
  "verified",
  "probable",
  "stated",
  "unavailable",
]);

export const flagSeverityEnum = pgEnum("flag_severity", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const flagConfidenceEnum = pgEnum("flag_confidence", [
  "confirmed",
  "probable",
  "unconfirmed",
]);

/**
 * Deliberately verdict-led rather than score-led.
 *
 * Public-domain data can establish that a contractor is risky; it cannot
 * establish that one is safe, because late payment to suppliers leaves no
 * public trace until it becomes litigation. `clear` therefore means "no adverse
 * signal found across the sources we could check" — not "creditworthy".
 *
 * `insufficient_data` is a first-class outcome, not an error. Returning it
 * honestly is more defensible than scoring thin coverage.
 */
export const verdictEnum = pgEnum("verdict", [
  "clear",
  "caution",
  "adverse",
  "insufficient_data",
]);

// ---------------------------------------------------------------------------
// Contractors
// ---------------------------------------------------------------------------

export const contractors = pgTable(
  "contractors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name"),
    entityType: entityTypeEnum("entity_type").notNull().default("unknown"),

    // Public identifiers. Each unlocks a different set of sources; none are
    // required, because assessment often starts from a name and a GSTIN alone.
    gstin: text("gstin"),
    pan: text("pan"),
    cin: text("cin"),
    udyamNumber: text("udyam_number"),
    epfoCode: text("epfo_code"),

    state: text("state"),
    address: text("address"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("contractors_gstin_idx").on(t.gstin),
    index("contractors_pan_idx").on(t.pan),
    index("contractors_legal_name_idx").on(t.legalName),
  ],
);

// ---------------------------------------------------------------------------
// Source registry
// ---------------------------------------------------------------------------

/**
 * The catalogue of public sources the system knows how to query, held as data
 * rather than code so coverage can be computed by joining against it and new
 * sources can be added without a migration.
 *
 * `tier` reflects signal quality: tier 1 is behavioural and current (GST filing
 * cadence, EPFO contribution continuity, litigation), tier 2 structural (MCA
 * filings, registered charges), tier 3 pipeline and reputation (tenders,
 * debarment lists, RERA).
 */
export const sources = pgTable("sources", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  tier: integer("tier").notNull(),
  description: text("description"),

  /** Entity types this source can return anything for. */
  applicableEntityTypes: text("applicable_entity_types").array().notNull(),
  requiresIdentifier: identifierKindEnum("requires_identifier").notNull(),

  /** Aggregator or portal backing this source. Kept swappable by design. */
  provider: text("provider"),
  sourceUrl: text("source_url"),

  /**
   * Whether matching on this source is inherently ambiguous. Court records are;
   * GSTIN lookups are not. Drives the default verification level of derived
   * evidence.
   */
  isNameMatched: boolean("is_name_matched").notNull().default(false),

  isActive: boolean("is_active").notNull().default(true),
});

// ---------------------------------------------------------------------------
// Checks — one execution of one source against one contractor
// ---------------------------------------------------------------------------

export const checks = pgTable(
  "checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractorId: uuid("contractor_id")
      .notNull()
      .references(() => contractors.id, { onDelete: "cascade" }),
    sourceKey: text("source_key")
      .notNull()
      .references(() => sources.key),

    status: checkStatusEnum("status").notNull().default("pending"),

    /**
     * The unmodified payload the source returned.
     *
     * Retained for two reasons: evidence can be re-derived if extraction logic
     * changes without re-querying, and it is the artefact that proves what the
     * portal actually said on the date it was asked. That second reason is the
     * whole basis of the report's defensibility.
     */
    rawResponse: jsonb("raw_response"),

    provider: text("provider"),
    errorMessage: text("error_message"),

    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("checks_contractor_idx").on(t.contractorId),
    index("checks_source_idx").on(t.sourceKey),
  ],
);

// ---------------------------------------------------------------------------
// Evidence — individual claims extracted from checks
// ---------------------------------------------------------------------------

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checkId: uuid("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id")
      .notNull()
      .references(() => contractors.id, { onDelete: "cascade" }),
    sourceKey: text("source_key")
      .notNull()
      .references(() => sources.key),

    /** Dotted path, e.g. `gst.filing_status`, `epfo.last_contribution_month`. */
    fieldKey: text("field_key").notNull(),
    value: jsonb("value"),

    verificationLevel: verificationLevelEnum("verification_level").notNull(),

    /** When the source observed this — not when we asked. The two can differ. */
    observedAt: timestamp("observed_at", { withTimezone: true }),

    /** Deep link or document reference a vendor can independently open. */
    sourceReference: text("source_reference"),
    note: text("note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("evidence_contractor_idx").on(t.contractorId),
    index("evidence_check_idx").on(t.checkId),
    index("evidence_field_idx").on(t.fieldKey),
  ],
);

// ---------------------------------------------------------------------------
// Flags — adverse findings
// ---------------------------------------------------------------------------

export const flags = pgTable(
  "flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractorId: uuid("contractor_id")
      .notNull()
      .references(() => contractors.id, { onDelete: "cascade" }),
    checkId: uuid("check_id").references(() => checks.id, {
      onDelete: "set null",
    }),
    sourceKey: text("source_key").references(() => sources.key),

    /** Stable machine code, e.g. `GST_CANCELLED`, `EPFO_CONTRIBUTIONS_LAPSED`. */
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),

    severity: flagSeverityEnum("severity").notNull(),

    /**
     * Kept separate from severity on purpose. A cheque-bounce case is high
     * severity but may be only a probable match; collapsing the two would let
     * a name collision produce an adverse verdict.
     */
    confidence: flagConfidenceEnum("confidence").notNull(),

    /** The specific evidence row this flag was raised from. */
    evidenceId: uuid("evidence_id").references(() => evidence.id, {
      onDelete: "set null",
    }),

    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Set when a human disambiguates or the underlying issue is cleared. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
  },
  (t) => [
    index("flags_contractor_idx").on(t.contractorId),
    index("flags_code_idx").on(t.code),
  ],
);

// ---------------------------------------------------------------------------
// Assessments — a generated report
// ---------------------------------------------------------------------------

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractorId: uuid("contractor_id")
      .notNull()
      .references(() => contractors.id, { onDelete: "cascade" }),

    verdict: verdictEnum("verdict").notNull(),

    /**
     * Coverage is reported, not hidden. `applicable` counts sources valid for
     * this entity type; `checked` counts those that actually returned. A vendor
     * reading "6 of 11" knows how much ground the report covers — which is the
     * difference between an honest document and a misleading one.
     */
    coverageChecked: integer("coverage_checked").notNull(),
    coverageApplicable: integer("coverage_applicable").notNull(),

    /**
     * Secondary to the verdict and nullable by design. With no outcome data to
     * calibrate against, a numeric score is a summary of evidence, not a
     * prediction — and is omitted entirely when coverage is too thin to support
     * one.
     */
    score: integer("score"),

    summary: text("summary"),

    /**
     * Pinned so historical reports stay interpretable after weights change.
     * A report issued today must remain explainable a year from now.
     */
    methodologyVersion: text("methodology_version").notNull(),

    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    generatedBy: text("generated_by"),
  },
  (t) => [index("assessments_contractor_idx").on(t.contractorId)],
);

/** Which checks fed a given assessment — freezes the report's basis. */
export const assessmentChecks = pgTable(
  "assessment_checks",
  {
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    checkId: uuid("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("assessment_checks_pk").on(t.assessmentId, t.checkId),
  ],
);
