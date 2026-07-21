/**
 * Parser for text pasted from a GST portal "Search Taxpayer" result (or a
 * comparable GST-lookup page).
 *
 * Same discipline as the MCA parser: extract what's recognisable, never invent
 * a field, and show the result for confirmation before storing. Unlike MCA
 * snapshots, GST portal data is live, so there's no staleness concern — what it
 * says is current as of the paste.
 *
 * Two signals carry most of the weight: registration status (a cancelled or
 * suspended GSTIN is the single strongest adverse signal available) and the
 * most recent return filed (a contractor who has stopped filing is usually in
 * trouble months before it shows up anywhere else).
 */

import { parseIndianDate } from "./indiafilings";

export type ParsedGst = {
  gstin?: string;
  legalName?: string;
  tradeName?: string;
  status?: string; // Active / Cancelled / Suspended
  registrationDate?: string;
  cancellationDate?: string;
  constitution?: string;
  taxpayerType?: string;
  natureOfBusiness?: string;
  lastFilingDate?: string; // most recent return filing date found
  lastFilingContext?: string; // the return row it came from, for display
  foundFields: string[];
};

const GSTIN_RE = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}\b/;
const DATE_RE = /\b(\d{2}[-/]\d{2}[-/]\d{4})\b/;

function splitLabelValue(line: string): [string, string] | null {
  const tab = line.indexOf("\t");
  if (tab !== -1) return [line.slice(0, tab).trim(), line.slice(tab + 1).trim()];
  const colon = line.match(/^(.+?)\s*:\s*(.+)$/);
  if (colon) return [colon[1].trim(), colon[2].trim()];
  const spaces = line.match(/^(.+?)\s{2,}(.+)$/);
  if (spaces) return [spaces[1].trim(), spaces[2].trim()];
  return null;
}

function pick(map: Map<string, string>, ...labels: string[]): string | undefined {
  for (const label of labels) {
    const key = label.toLowerCase().replace(/\s+/g, " ").trim();
    const hit = map.get(key);
    if (hit) return hit;
  }
  return undefined;
}

export function parseGst(raw: string): ParsedGst {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const map = new Map<string, string>();
  for (const line of lines) {
    const kv = splitLabelValue(line);
    if (kv && kv[0] && kv[1]) {
      const key = kv[0].toLowerCase().replace(/\s+/g, " ").trim();
      if (!map.has(key)) map.set(key, kv[1]);
    }
  }

  // GSTIN: prefer a labelled value, else the first thing that looks like one.
  let gstin = pick(
    map,
    "GSTIN/UIN of the Taxpayer",
    "GSTIN of the Taxpayer",
    "GSTIN/UIN",
    "GSTIN",
    "GSTIN / UIN",
  );
  if (!gstin) {
    const m = raw.match(GSTIN_RE);
    if (m) gstin = m[0];
  }

  const status =
    pick(map, "GSTIN / UIN Status", "GSTIN/UIN Status", "Status", "Registration Status") ??
    scanStatus(lines);

  const filing = latestFiling(lines);

  const result: ParsedGst = {
    gstin: gstin?.toUpperCase(),
    legalName: pick(map, "Legal Name of Business", "Legal Name", "Trade Name/Legal Name"),
    tradeName: pick(map, "Trade Name", "Trade Name of Business"),
    status,
    registrationDate: pick(
      map,
      "Effective Date of registration",
      "Date of registration",
      "Registration Date",
    ),
    cancellationDate: pick(map, "Effective Date of cancellation", "Date of cancellation"),
    constitution: pick(map, "Constitution of Business", "Constitution"),
    taxpayerType: pick(map, "Taxpayer Type", "Type of Taxpayer", "Dealer Type"),
    natureOfBusiness: pick(map, "Nature Of Business Activities", "Nature of Business"),
    lastFilingDate: filing?.date,
    lastFilingContext: filing?.context,
    foundFields: [],
  };

  result.foundFields = Object.entries(result)
    .filter(([k, v]) => k !== "foundFields" && k !== "lastFilingContext" && v)
    .map(([k]) => k);

  return result;
}

const STATUS_TOKENS = ["active", "cancelled", "canceled", "suspended", "inactive"];

function scanStatus(lines: string[]): string | undefined {
  const hit = lines.find((l) => STATUS_TOKENS.includes(l.toLowerCase()));
  return hit;
}

/**
 * Finds the most recent return filing date. Looks only at rows that mention a
 * return type (GSTR-…), so it never mistakes the registration date for a filing
 * date, then returns the latest date among them.
 */
function latestFiling(
  lines: string[],
): { date: string; context: string } | null {
  let best: { date: string; parsed: Date; context: string } | null = null;
  for (const line of lines) {
    if (!/gstr/i.test(line)) continue;
    const dm = line.match(DATE_RE);
    if (!dm) continue;
    const parsed = parseIndianDate(dm[1]);
    if (!parsed) continue;
    if (!best || parsed.getTime() > best.parsed.getTime()) {
      best = { date: dm[1], parsed, context: line.replace(/\s{2,}/g, " ").trim() };
    }
  }
  return best ? { date: best.date, context: best.context } : null;
}
