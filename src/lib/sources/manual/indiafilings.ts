/**
 * Parser for text pasted from an IndiaFilings company / LLP page.
 *
 * The page is semi-structured — mostly "Label<tab>Value" rows plus a directors
 * table. This extracts what it can and reports what it found; it never invents
 * a field. Anything it cannot locate is simply left undefined, so a partial or
 * reformatted paste degrades to fewer fields rather than to wrong ones. The
 * caller shows the parsed result for confirmation before any of it is stored.
 *
 * The single most important field is `observedAtRaw` — the page's "Last Updated
 * On" date. IndiaFilings snapshots can be years stale, so every fact parsed
 * here is only true *as of* that date, and the ingest records it as such.
 */

export type EntityKind = "llp" | "company" | "unknown";

export type ParsedDirector = {
  id: string; // DIN or PAN
  name: string;
  beginDate?: string;
};

export type ParsedMca = {
  entityKind: EntityKind;
  entityName?: string;
  registrationId?: string; // CIN or LLPIN
  registrationLabel?: "CIN" | "LLPIN";
  roc?: string;
  status?: string;
  incorporationDate?: string;
  registeredAddress?: string;
  email?: string;
  contribution?: string;
  authorisedCapital?: string;
  paidUpCapital?: string;
  businessDescription?: string;
  lastAnnualReturnFyEnd?: string;
  lastAccountsFyEnd?: string;
  observedAtRaw?: string; // "Last Updated On"
  directors: ParsedDirector[];
  /** Field keys successfully extracted — for the confirmation preview. */
  foundFields: string[];
};

const DIN_RE = /^\d{6,8}$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;

/** Splits a line into [label, value] on tab, " : ", or a run of 2+ spaces. */
function splitLabelValue(line: string): [string, string] | null {
  const tab = line.indexOf("\t");
  if (tab !== -1) {
    return [line.slice(0, tab).trim(), line.slice(tab + 1).trim()];
  }
  const colon = line.match(/^(.+?)\s*:\s*(.+)$/);
  if (colon) return [colon[1].trim(), colon[2].trim()];
  const spaces = line.match(/^(.+?)\s{2,}(.+)$/);
  if (spaces) return [spaces[1].trim(), spaces[2].trim()];
  return null;
}

/** Case/space-insensitive label lookup against the collected map. */
function pick(map: Map<string, string>, ...labels: string[]): string | undefined {
  for (const label of labels) {
    const key = label.toLowerCase().replace(/\s+/g, " ").trim();
    const hit = map.get(key);
    if (hit) return hit;
  }
  return undefined;
}

export function parseIndiaFilings(raw: string): ParsedMca {
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

  const llpin = pick(map, "LLPIN");
  const cin = pick(map, "CIN");
  const registrationId = llpin ?? cin;
  const registrationLabel: "CIN" | "LLPIN" | undefined = llpin
    ? "LLPIN"
    : cin
      ? "CIN"
      : undefined;
  const entityKind: EntityKind = llpin ? "llp" : cin ? "company" : "unknown";

  const result: ParsedMca = {
    entityKind,
    entityName: pick(map, "LLP Name", "Company Name", "Name"),
    registrationId,
    registrationLabel,
    roc: pick(map, "ROC Code", "ROC", "RoC"),
    status: pick(map, "LLP Status", "Company Status", "Status"),
    incorporationDate: pick(map, "Date of Incorporation", "Incorporation Date"),
    registeredAddress: pick(map, "Registered Address", "Address"),
    email: pick(map, "Email ID", "Email"),
    contribution: pick(map, "Total Obligation of Contribution", "Contribution"),
    authorisedCapital: pick(map, "Authorised Capital", "Authorized Capital"),
    paidUpCapital: pick(map, "Paid up Capital", "Paid-up Capital"),
    businessDescription: pick(
      map,
      "Description of main division",
      "Company Category",
      "Description",
    ),
    lastAnnualReturnFyEnd: pick(
      map,
      "Date of last financial year end for Annual Return filed",
      "Date of last Annual General Meeting",
    ),
    lastAccountsFyEnd: pick(
      map,
      "Date of last financial year end for Statement of Accounts and Solvency",
      "Date of Balance Sheet",
    ),
    observedAtRaw: pick(map, "Last Updated On", "Last Updated", "Updated On"),
    directors: parseDirectors(lines),
    foundFields: [],
  };

  // Some pages print the status as a bare word (e.g. "Active") before any
  // labelled rows; fall back to scanning for a known status token.
  if (!result.status) {
    const known = ["active", "strike off", "struck off", "under liquidation", "dormant", "amalgamated", "dissolved"];
    const hit = lines.find((l) => known.includes(l.toLowerCase()));
    if (hit) result.status = hit;
  }

  result.foundFields = Object.entries(result)
    .filter(
      ([k, v]) =>
        k !== "foundFields" &&
        k !== "directors" &&
        k !== "entityKind" &&
        v !== undefined &&
        v !== "",
    )
    .map(([k]) => k);
  if (result.directors.length > 0) result.foundFields.push("directors");

  return result;
}

/**
 * Extracts the directors/partners table. Looks for the header row, then reads
 * following lines whose first token is a DIN or PAN.
 */
function parseDirectors(lines: string[]): ParsedDirector[] {
  const headerIdx = lines.findIndex(
    (l) =>
      /din/i.test(l) &&
      /name/i.test(l) &&
      /(begin|date|appoint)/i.test(l),
  );
  const directors: ParsedDirector[] = [];
  const start = headerIdx === -1 ? 0 : headerIdx + 1;

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(/\t| {2,}/).map((c) => c.trim()).filter(Boolean);
    if (cols.length < 2) continue;
    const id = cols[0].toUpperCase();
    if (DIN_RE.test(id) || PAN_RE.test(id)) {
      directors.push({
        id,
        name: cols[1],
        beginDate: cols[2],
      });
    } else if (headerIdx !== -1 && directors.length > 0) {
      // We were inside the table and hit a non-director row → table ended.
      break;
    }
  }
  return directors;
}

/**
 * Parses Indian date strings into a Date. Handles DD-MM-YYYY (IndiaFilings
 * display) and YYYY-MM-DD (financial-year fields). Returns null on anything
 * unrecognised rather than guessing.
 */
export function parseIndianDate(s: string | undefined): Date | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return safeDate(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return safeDate(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return safeDate(+m[3], +m[2], +m[1]);
  return null;
}

function safeDate(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return isNaN(dt.getTime()) ? null : dt;
}
