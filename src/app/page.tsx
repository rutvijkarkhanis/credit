import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessments, contractors } from "@/db/schema";
import { IntakeForm } from "@/components/IntakeForm";
import { ENTITY_LABEL, VERDICT_UI } from "@/lib/ui";

export const dynamic = "force-dynamic";

async function recentContractors() {
  const rows = await db
    .select({
      id: contractors.id,
      legalName: contractors.legalName,
      entityType: contractors.entityType,
      createdAt: contractors.createdAt,
    })
    .from(contractors)
    .orderBy(desc(contractors.createdAt))
    .limit(8);

  // Attach each contractor's latest verdict, if any.
  return Promise.all(
    rows.map(async (c) => {
      const [a] = await db
        .select({ verdict: assessments.verdict, score: assessments.score })
        .from(assessments)
        .where(eq(assessments.contractorId, c.id))
        .orderBy(desc(assessments.generatedAt))
        .limit(1);
      return { ...c, verdict: a?.verdict, score: a?.score };
    }),
  );
}

export default async function Home() {
  let recent: Awaited<ReturnType<typeof recentContractors>> = [];
  let dbError = false;
  try {
    recent = await recentContractors();
  } catch {
    dbError = true;
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Contractor credit assessment
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Public-domain screening. Flags what the record shows; never claims a
          contractor is safe on the strength of what it doesn&apos;t.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              New assessment
            </h2>
            <IntakeForm />
          </div>
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent</h2>
          {dbError ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-600/20">
              Database not reachable. Set <code>DATABASE_URL</code> in the
              environment.
            </p>
          ) : recent.length === 0 ? (
            <p className="text-sm text-slate-400">No contractors assessed yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((c) => {
                const v = c.verdict ? VERDICT_UI[c.verdict] : null;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/contractors/${c.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {c.legalName}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {ENTITY_LABEL[c.entityType]}
                        </span>
                      </span>
                      {v && (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${v.badge}`}
                        >
                          {v.label}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
