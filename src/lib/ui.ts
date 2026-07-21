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
