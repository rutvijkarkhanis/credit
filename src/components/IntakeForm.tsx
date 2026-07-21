"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createAndAssess, type IntakeState } from "@/app/actions";
import { ENTITY_LABEL } from "@/lib/ui";
import { ENTITY_TYPES } from "@/lib/validation";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Running round-1 checks…" : "Assess contractor"}
    </button>
  );
}

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10";
const label = "block text-xs font-medium text-slate-600 mb-1.5";

export function IntakeForm() {
  const [state, formAction] = useActionState<IntakeState, FormData>(
    createAndAssess,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={label} htmlFor="legalName">
          Legal name <span className="text-red-500">*</span>
        </label>
        <input
          id="legalName"
          name="legalName"
          required
          placeholder="e.g. Sharma Construction Co."
          className={field}
        />
      </div>

      <div>
        <label className={label} htmlFor="tradeName">
          Trade name
        </label>
        <input id="tradeName" name="tradeName" className={field} />
      </div>

      <div>
        <label className={label} htmlFor="entityType">
          Entity type
        </label>
        <select id="entityType" name="entityType" defaultValue="proprietorship" className={field}>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {ENTITY_LABEL[t]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">
          Drives which sources apply. Proprietorships have no registrar record,
          so fewer sources are checked.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="gstin">
            GSTIN
          </label>
          <input
            id="gstin"
            name="gstin"
            placeholder="22AAAAA0000A1Z5"
            autoCapitalize="characters"
            className={`${field} uppercase`}
          />
        </div>
        <div>
          <label className={label} htmlFor="pan">
            PAN
          </label>
          <input
            id="pan"
            name="pan"
            placeholder="AAAAA0000A"
            autoCapitalize="characters"
            className={`${field} uppercase`}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="state">
          State
        </label>
        <input id="state" name="state" placeholder="Maharashtra" className={field} />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-600/20">
          {state.error}
        </p>
      )}

      <SubmitButton />
      <p className="text-center text-[11px] text-slate-400">
        Round 1 checks free / low-cost public sources only. No contractor
        consent required.
      </p>
    </form>
  );
}
