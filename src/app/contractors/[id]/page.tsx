import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  assessmentChecks,
  assessments,
  checks,
  contractors,
  evidence as evidenceTable,
  flags as flagsTable,
  sources,
} from "@/db/schema";
import { reassess } from "@/app/actions";
import {
  CONFIDENCE_UI,
  ENTITY_LABEL,
  SEVERITY_UI,
  VERDICT_UI,
  VERIFICATION_UI,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

export default async function ContractorReport({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [contractor] = await db
    .select()
    .from(contractors)
    .where(eq(contractors.id, id));
  if (!contractor) notFound();

  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.contractorId, id))
    .orderBy(desc(assessments.generatedAt))
    .limit(1);

  // Checks that fed this specific assessment.
  const checkLinks = assessment
    ? await db
        .select({ checkId: assessmentChecks.checkId })
        .from(assessmentChecks)
        .where(eq(assessmentChecks.assessmentId, assessment.id))
    : [];
  const checkIds = checkLinks.map((c) => c.checkId);

  const [checkRows, evidenceRows, flagRows, allSources] = await Promise.all([
    checkIds.length
      ? db.select().from(checks).where(inArray(checks.id, checkIds))
      : Promise.resolve([]),
    checkIds.length
      ? db
          .select()
          .from(evidenceTable)
          .where(inArray(evidenceTable.checkId, checkIds))
      : Promise.resolve([]),
    checkIds.length
      ? db.select().from(flagsTable).where(inArray(flagsTable.checkId, checkIds))
      : Promise.resolve([]),
    db.select().from(sources),
  ]);

  const sourceName = new Map(allSources.map((s) => [s.key, s.name]));
  const evidenceByCheck = new Map<string, typeof evidenceRows>();
  for (const e of evidenceRows) {
    const list = evidenceByCheck.get(e.checkId) ?? [];
    list.push(e);
    evidenceByCheck.set(e.checkId, list);
  }

  const sortedFlags = [...flagRows].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  const v = assessment ? VERDICT_UI[assessment.verdict] : null;
  const coveragePct =
    assessment && assessment.coverageApplicable > 0
      ? Math.round(
          (assessment.coverageChecked / assessment.coverageApplicable) * 100,
        )
      : 0;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <Link
        href="/"
        className="text-xs text-slate-400 transition hover:text-slate-600"
      >
        ← All contractors
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {contractor.legalName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {ENTITY_LABEL[contractor.entityType]}
            {contractor.tradeName ? ` · ${contractor.tradeName}` : ""}
            {contractor.state ? ` · ${contractor.state}` : ""}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-400">
            {contractor.gstin ? `GSTIN ${contractor.gstin}` : "No GSTIN"}
            {contractor.pan ? ` · PAN ${contractor.pan}` : ""}
          </p>
        </div>
        {v && (
          <span
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${v.badge}`}
          >
            {v.label}
          </span>
        )}
      </div>

      {!assessment ? (
        <p className="mt-8 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          No assessment on record for this contractor yet.
        </p>
      ) : (
        <>
          {/* Verdict summary */}
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-700">{assessment.summary}</p>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>Coverage</span>
                  <span>
                    {assessment.coverageChecked} / {assessment.coverageApplicable}{" "}
                    sources
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${v?.bar ?? "bg-slate-400"}`}
                    style={{ width: `${coveragePct}%` }}
                  />
                </div>
              </div>
              {assessment.score !== null && (
                <div className="text-right">
                  <div className="text-2xl font-semibold tabular-nums text-slate-900">
                    {assessment.score}
                  </div>
                  <div className="text-[11px] text-slate-400">/ 100</div>
                </div>
              )}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Methodology {assessment.methodologyVersion} · Generated{" "}
              {fmtDate(assessment.generatedAt)}
            </p>
          </section>

          {/* Flags */}
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Findings{" "}
              <span className="font-normal text-slate-400">
                ({sortedFlags.length})
              </span>
            </h2>
            {sortedFlags.length === 0 ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-800">
                No adverse findings across the sources checked. This is not proof
                of payment discipline — late payment to suppliers leaves no
                public trace until it becomes litigation.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {sortedFlags.map((f) => {
                  const sev = SEVERITY_UI[f.severity];
                  const conf = CONFIDENCE_UI[f.confidence];
                  return (
                    <li
                      key={f.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${sev.dot}`}
                          />
                          <span className="text-sm font-medium text-slate-900">
                            {f.title}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${conf.className}`}
                        >
                          {conf.label}
                        </span>
                      </div>
                      {f.description && (
                        <p className="mt-1.5 pl-4 text-xs text-slate-500">
                          {f.description}
                        </p>
                      )}
                      <p className="mt-1.5 pl-4 text-[11px] text-slate-400">
                        {sev.label} · {sourceName.get(f.sourceKey ?? "") ?? f.sourceKey}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Evidence, grouped by source/check */}
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Evidence
            </h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {checkRows.map((chk, i) => {
                const evs = evidenceByCheck.get(chk.id) ?? [];
                return (
                  <div
                    key={chk.id}
                    className={i > 0 ? "border-t border-slate-100" : ""}
                  >
                    <div className="flex items-center justify-between bg-slate-50/60 px-4 py-2">
                      <span className="text-xs font-medium text-slate-700">
                        {sourceName.get(chk.sourceKey) ?? chk.sourceKey}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">
                        {chk.status.replace("_", " ")}
                      </span>
                    </div>
                    {evs.length === 0 ? (
                      <p className="px-4 py-2.5 text-xs text-slate-400">
                        No extracted fields.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-50">
                        {evs.map((e) => {
                          const ver = VERIFICATION_UI[e.verificationLevel];
                          return (
                            <li key={e.id} className="px-4 py-2.5">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="font-mono text-[11px] text-slate-400">
                                  {e.fieldKey}
                                </span>
                                <span
                                  className={`text-[11px] font-medium ${ver.className}`}
                                >
                                  {ver.label}
                                </span>
                              </div>
                              <div className="mt-0.5 text-sm text-slate-800">
                                {JSON.stringify(e.value)}
                              </div>
                              {e.note && (
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {e.note}
                                </p>
                              )}
                              {e.sourceReference && (
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  {e.sourceReference}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <form action={reassess}>
              <input type="hidden" name="contractorId" value={contractor.id} />
              <input type="hidden" name="tier" value="1" />
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Re-run round 1
              </button>
            </form>
            <Link
              href={`/contractors/${contractor.id}/gst`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Add GST data (paste)
            </Link>
            <Link
              href={`/contractors/${contractor.id}/mca`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Add MCA data (paste)
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
