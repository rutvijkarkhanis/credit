/**
 * Presentation maps shared by server and client components. Plain data only, so
 * either can import it. Colour choices reinforce the methodology: adverse is
 * unambiguous red, clear is a muted green (not a celebratory one — "clear"
 * means no red flags, not "safe"), insufficient_data is neutral grey rather
 * than anything that reads as pass or fail.
 */

export const VERDICT_UI: Record<
  string,
  { label: string; badge: string; bar: string }
> = {
  clear: {
    label: "Clear",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    bar: "bg-emerald-500",
  },
  caution: {
    label: "Caution",
    badge: "bg-amber-50 text-amber-900 ring-amber-600/30",
    bar: "bg-amber-500",
  },
  adverse: {
    label: "Adverse",
    badge: "bg-red-50 text-red-800 ring-red-600/20",
    bar: "bg-red-500",
  },
  insufficient_data: {
    label: "Insufficient data",
    badge: "bg-slate-100 text-slate-700 ring-slate-500/20",
    bar: "bg-slate-400",
  },
};

export const SEVERITY_UI: Record<string, { label: string; dot: string }> = {
  critical: { label: "Critical", dot: "bg-red-600" },
  high: { label: "High", dot: "bg-orange-500" },
  medium: { label: "Medium", dot: "bg-amber-500" },
  low: { label: "Low", dot: "bg-yellow-400" },
  info: { label: "Info", dot: "bg-slate-400" },
};

export const CONFIDENCE_UI: Record<string, { label: string; className: string }> =
  {
    confirmed: {
      label: "Confirmed",
      className: "bg-slate-800 text-white",
    },
    probable: {
      label: "Probable match",
      className: "bg-amber-100 text-amber-900 ring-1 ring-amber-500/30",
    },
    unconfirmed: {
      label: "Unconfirmed",
      className: "bg-slate-100 text-slate-600",
    },
  };

export const VERIFICATION_UI: Record<string, { label: string; className: string }> =
  {
    verified: { label: "Verified", className: "text-emerald-700" },
    probable: { label: "Probable", className: "text-amber-700" },
    stated: { label: "Contractor-stated", className: "text-slate-500" },
    unavailable: { label: "Unavailable", className: "text-slate-400" },
  };

/**
 * Plain-language sentiment labels shown next to every finding and evidence
 * line, so a non-technical reader can tell at a glance whether an item is
 * reassuring, a warning, or just a neutral fact.
 */
export const TONE_UI: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  good: {
    label: "Good",
    className: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  bad: {
    label: "Bad",
    className: "bg-red-100 text-red-800",
    dot: "bg-red-500",
  },
  check: {
    label: "Check",
    className: "bg-amber-100 text-amber-900",
    dot: "bg-amber-500",
  },
  info: {
    label: "Info",
    className: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
};

/** Friendly names for the technical evidence field keys. */
export const FIELD_LABEL: Record<string, string> = {
  "gst.status": "GST status",
  "gst.registration_date": "GST registered on",
  "gst.constitution": "Business type (GST)",
  "gst.taxpayer_type": "Taxpayer type",
  "gst.nature_of_business": "Type of work",
  "gst.last_return_filed": "Last GST return filed",
  "gst.cancellation_date": "GST cancelled on",
  "gst.months_since_last_return": "Months since last GST return",
  "mca.status": "Company status",
  "mca.registration_id": "Registration no.",
  "mca.incorporation_date": "Incorporated on",
  "mca.roc": "Registrar (ROC)",
  "mca.registered_address": "Registered address",
  "mca.contribution": "Capital contribution",
  "mca.paid_up_capital": "Paid-up capital",
  "mca.directors": "Directors / partners",
  "mca.last_annual_return_fy_end": "Last annual return",
  "mca.last_accounts_fy_end": "Last accounts filed",
  "epfo.active_members": "Employees (provident fund)",
  "litigation.cheque_bounce_cases": "Cheque-bounce cases",
  "insolvency.status": "Insolvency / bankruptcy",
  "debarment.entry": "Blacklist / debarment",
};

export const ENTITY_LABEL: Record<string, string> = {
  proprietorship: "Proprietorship",
  partnership: "Partnership",
  llp: "LLP",
  private_limited: "Private Limited",
  public_limited: "Public Limited",
  huf: "HUF",
  trust: "Trust",
  society: "Society",
  unknown: "Unknown",
};
