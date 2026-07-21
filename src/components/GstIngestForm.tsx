"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { previewGst, attachGst, type GstPreviewState } from "@/app/actions";

function PreviewButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Parsing…" : "Parse"}
    </button>
  );
}

function AttachButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
    >
      {pending ? "Attaching & re-assessing…" : "Confirm & attach"}
    </button>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

const STATUS_STYLE = (status?: string) => {
  const s = (status ?? "").toLowerCase();
  if (s.includes("cancel") || s.includes("suspend") || s.includes("inactive"))
    return "text-red-700";
  if (s.includes("active")) return "text-emerald-700";
  return "text-slate-800";
};

export function GstIngestForm({ contractorId }: { contractorId: string }) {
  const [state, formAction] = useActionState<GstPreviewState, FormData>(
    previewGst,
    {},
  );
  const p = state.parsed;

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-3">
        <label htmlFor="rawText" className="block text-xs font-medium text-slate-600">
          Paste the GST portal taxpayer details (and filing table, if shown)
        </label>
        <textarea
          id="rawText"
          name="rawText"
          rows={8}
          defaultValue={state.rawText}
          placeholder="On gst.gov.in → Search Taxpayer, select all the details text and paste here…"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-600/20">
            {state.error}
          </p>
        )}
        <PreviewButton />
      </form>

      {p && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Review extracted data
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
              {p.foundFields.length} fields
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            <Row label="GSTIN" value={p.gstin} />
            <Row label="Legal name" value={p.legalName} />
            <Row label="Trade name" value={p.tradeName} />
            <div className="flex justify-between gap-4 py-1.5 text-sm">
              <span className="text-slate-500">Status</span>
              <span className={`font-semibold ${STATUS_STYLE(p.status)}`}>
                {p.status ?? "—"}
              </span>
            </div>
            <Row label="Registered" value={p.registrationDate} />
            <Row label="Constitution" value={p.constitution} />
            <Row label="Taxpayer type" value={p.taxpayerType} />
            <Row label="Last return filed" value={p.lastFilingDate} />
          </div>

          {!p.lastFilingDate && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              No return-filing dates were found in the pasted text. Include the
              filing table if you want the filing-history check to run.
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <form action={attachGst}>
              <input type="hidden" name="contractorId" value={contractorId} />
              <input type="hidden" name="rawText" value={state.rawText} />
              <AttachButton />
            </form>
            <Link
              href={`/contractors/${contractorId}`}
              className="text-sm text-slate-500 transition hover:text-slate-700"
            >
              Cancel
            </Link>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Attaching replaces any prior GST data for this contractor and re-runs
            the assessment.
          </p>
        </div>
      )}
    </div>
  );
}
