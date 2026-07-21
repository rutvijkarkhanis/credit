/**
 * Mock adapters for the tier-1 public sources.
 *
 * Each mirrors the shape of what its real counterpart would return and produces
 * genuine evidence and flags, so the whole pipeline — persistence, verdict,
 * coverage, report — can be exercised end to end before a rupee is spent on an
 * aggregator. Behaviour is deterministic (see mock-scenario.ts).
 *
 * The registry at the bottom maps source keys to adapters. A source with no
 * adapter is simply not run; the engine treats it as unqueried, which keeps
 * coverage honest.
 */

import type { CheckOutcome, ContractorIdentifiers, SourceAdapter } from "./types";
import {
  derivedFilingLapseMonths,
  derivedHeadcount,
  nameSignals,
} from "./mock-scenario";

const PROVIDER = "mock";

/** Adapters that key off a name-matched list share this "no records" default. */
function cleanNameMatch(fieldKey: string, label: string): CheckOutcome {
  return {
    status: "not_found",
    raw: { matched: false },
    provider: PROVIDER,
    observedAt: new Date(),
    evidence: [
      {
        fieldKey,
        value: { found: false },
        verificationLevel: "verified",
        note: `No ${label} found in searched records.`,
      },
    ],
    flags: [],
  };
}

const gstProfile: SourceAdapter = {
  key: "gst_profile",
  async run(c) {
    if (!c.gstin) {
      return {
        status: "not_applicable",
        raw: null,
        provider: PROVIDER,
        evidence: [],
        flags: [],
      };
    }
    const sig = nameSignals(c.legalName);
    const status = sig.forceGstCancelled ? "Cancelled" : "Active";
    const raw = { gstin: c.gstin, status, constitution: c.entityType };

    const outcome: CheckOutcome = {
      status: "success",
      raw,
      provider: PROVIDER,
      observedAt: new Date(),
      evidence: [
        {
          fieldKey: "gst.status",
          value: status,
          verificationLevel: "verified",
          sourceReference: `GST portal · ${c.gstin}`,
        },
      ],
      flags: [],
    };
    if (status === "Cancelled") {
      outcome.flags.push({
        code: "GST_CANCELLED",
        title: "GST registration cancelled",
        description:
          "The GSTIN is no longer active. A cancelled registration is one of the strongest single adverse signals in the public record.",
        severity: "critical",
        confidence: "confirmed",
        evidenceIndex: 0,
      });
    }
    return outcome;
  },
};

const gstFiling: SourceAdapter = {
  key: "gst_filing",
  async run(c) {
    if (!c.gstin) {
      return {
        status: "not_applicable",
        raw: null,
        provider: PROVIDER,
        evidence: [],
        flags: [],
      };
    }
    const sig = nameSignals(c.legalName);
    const lapseMonths = sig.forceFilingLapsed
      ? 6
      : derivedFilingLapseMonths(c.gstin);

    const raw = { gstin: c.gstin, monthsSinceLastReturn: lapseMonths };
    const outcome: CheckOutcome = {
      status: "success",
      raw,
      provider: PROVIDER,
      observedAt: new Date(),
      evidence: [
        {
          fieldKey: "gst.months_since_last_return",
          value: lapseMonths,
          verificationLevel: "verified",
          sourceReference: `GST portal · ${c.gstin}`,
          note:
            lapseMonths === 0
              ? "Returns filed to the current period."
              : `Last return filed roughly ${lapseMonths} month(s) ago.`,
        },
      ],
      flags: [],
    };
    // A lapse in GST filing is an early distress signal. Severity scales with
    // how long the contractor has been silent.
    if (lapseMonths >= 3) {
      outcome.flags.push({
        code: "GST_FILINGS_LAPSED",
        title: "GST returns lapsed",
        description: `No GST return filed for roughly ${lapseMonths} months. Filing gaps commonly precede payment distress.`,
        severity: lapseMonths >= 6 ? "high" : "medium",
        confidence: "confirmed",
        evidenceIndex: 0,
      });
    }
    return outcome;
  },
};

const epfoContributions: SourceAdapter = {
  key: "epfo_contributions",
  async run(c) {
    const headcount = derivedHeadcount(c.id || c.legalName);
    return {
      status: "success",
      raw: { establishment: c.legalName, activeMembers: headcount },
      provider: PROVIDER,
      observedAt: new Date(),
      evidence: [
        {
          fieldKey: "epfo.active_members",
          value: headcount,
          // Name-matched source, so corroborating operations but not identity-proof.
          verificationLevel: "probable",
          note: `Establishment with ~${headcount} active PF members; contributions current.`,
        },
      ],
      flags: [],
    };
  },
};

const litigationChequeBounce: SourceAdapter = {
  key: "litigation_cheque_bounce",
  async run(c) {
    const sig = nameSignals(c.legalName);
    if (sig.forceChequeCase) {
      // Deliberately raised at `probable` confidence: court records are
      // name-matched and this may be a namesake. It must not, on its own,
      // drive an adverse verdict.
      const probable = sig.forceProbableMatch;
      return {
        status: "success",
        raw: { matched: true, cases: 1, matchQuality: probable ? "name-only" : "name+address" },
        provider: PROVIDER,
        observedAt: new Date(),
        evidence: [
          {
            fieldKey: "litigation.cheque_bounce_cases",
            value: 1,
            verificationLevel: probable ? "probable" : "verified",
            note: probable
              ? "One S.138 case on a name-only match — likely but not confirmed to be this entity."
              : "One S.138 cheque-dishonour case matched on name and address.",
          },
        ],
        flags: [
          {
            code: "CHEQUE_BOUNCE_CASE",
            title: "Cheque dishonour case (S.138)",
            description:
              "A Section 138 proceeding was found. Directly relevant to payment behaviour.",
            severity: "high",
            confidence: probable ? "probable" : "confirmed",
            evidenceIndex: 0,
          },
        ],
      };
    }
    return cleanNameMatch(
      "litigation.cheque_bounce_cases",
      "cheque-dishonour cases",
    );
  },
};

const insolvencyIbbi: SourceAdapter = {
  key: "insolvency_ibbi",
  async run(c) {
    const sig = nameSignals(c.legalName);
    if (sig.forceInsolvency) {
      return {
        status: "success",
        raw: { matched: true, stage: "CIRP admitted" },
        provider: PROVIDER,
        observedAt: new Date(),
        evidence: [
          {
            fieldKey: "insolvency.status",
            value: "CIRP admitted",
            verificationLevel: "verified",
            note: "Corporate insolvency resolution process admitted.",
          },
        ],
        flags: [
          {
            code: "INSOLVENCY_PROCEEDING",
            title: "Insolvency proceeding admitted",
            description:
              "The entity is under CIRP. Definitive adverse signal when confirmed.",
            severity: "critical",
            confidence: "confirmed",
            evidenceIndex: 0,
          },
        ],
      };
    }
    return cleanNameMatch("insolvency.status", "insolvency proceedings");
  },
};

const debarmentLists: SourceAdapter = {
  key: "debarment_lists",
  async run(c) {
    const sig = nameSignals(c.legalName);
    if (sig.forceDebarred) {
      return {
        status: "success",
        raw: { matched: true, authority: "PSU (mock)" },
        provider: PROVIDER,
        observedAt: new Date(),
        evidence: [
          {
            fieldKey: "debarment.entry",
            value: true,
            verificationLevel: "verified",
            note: "Debarment entry found against this name.",
          },
        ],
        flags: [
          {
            code: "DEBARRED",
            title: "Debarment / blacklist entry",
            description:
              "A public body has debarred this contractor. Binary disqualifier when confirmed.",
            severity: "critical",
            confidence: "confirmed",
            evidenceIndex: 0,
          },
        ],
      };
    }
    return cleanNameMatch("debarment.entry", "debarment or blacklist entries");
  },
};

const ADAPTERS: SourceAdapter[] = [
  gstProfile,
  gstFiling,
  epfoContributions,
  litigationChequeBounce,
  insolvencyIbbi,
  debarmentLists,
];

const ADAPTER_BY_KEY = new Map(ADAPTERS.map((a) => [a.key, a]));

export function getAdapter(sourceKey: string): SourceAdapter | undefined {
  return ADAPTER_BY_KEY.get(sourceKey);
}

export type { ContractorIdentifiers };
