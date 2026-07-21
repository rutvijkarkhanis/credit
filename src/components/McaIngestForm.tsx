"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { previewMca, attachMca, type McaPreviewState } from "@/app/actions";

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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === "" || value === null) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

export function McaIngestForm({ contractorId }: { contractorId: string }) {
  const [state, formAction] = useActionState<McaPreviewState, FormData>(
    previewMca,
    {},
  );
  const p = state.parsed;

  return (
    <div className="space-y-6">
      {/* Step 1 — paste + parse */}
      <form action={formAction} className="space-y-3">
        <label
          htmlFor="rawText"
          className="block text-xs font-medium text-slate-600"
        >
          Paste the full text from the IndiaFilings company / LLP page
        </label>
        <textarea
          id="rawText"
          name="rawText"
          rows={8}
          defaultValue={state.rawText}
          placeholder="Select all text on the IndiaFilings page (Ctrl/Cmd+A), copy, and paste here…"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-600/20">
            {state.error}
          </p>
        )}
        <PreviewButton />
      </form>

      {/* Step 2 — confirm parsed fields */}
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

          {p.observedAtRaw && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-500/20">
              Snapshot dated <strong>{p.observedAtRaw}</strong>. Every field
              below is recorded as true <em>as of that date</em> — not
              necessarily today.
            </p>
          )}

          <div className="divide-y divide-slate-100">
            <Row label="Entity" value={p.entityName} />
            <Row
              label={p.registrationLabel ?? "Registration"}
              value={p.registrationId}
            />
            <Row label="Status" value={p.status} />
            <Row label="ROC" value={p.roc} />
            <Row label="Incorporated" value={p.incorporationDate} />
            <Row label="Contribution" value={p.contribution} />
            <Row label="Paid-up capital" value={p.paidUpCapital} />
            <Row label="Business" value={p.businessDescription} />
            <Row
              label="Last annual return (FY end)"
              value={p.lastAnnualReturnFyEnd}
            />
            <Row label="Address" value={p.registeredAddress} />
            {p.directors.length > 0 && (
              <div className="py-2 text-sm">
                <span className="text-slate-500">Directors / partners</span>
                <ul className="mt-1 space-y-0.5">
                  {p.directors.map((d) => (
                    <li key={d.id} className="text-slate-800">
                      {d.name}{" "}
                      <span className="font-mono text-xs text-slate-400">
                        ({d.id})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <form action={attachMca}>
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
            Attaching replaces any prior MCA data for this contractor and re-runs
            the assessment across tiers 1 and 2.
          </p>
        </div>
      )}
    </div>
  );
}
