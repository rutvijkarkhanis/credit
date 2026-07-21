import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contractors } from "@/db/schema";
import { GstIngestForm } from "@/components/GstIngestForm";
import { ENTITY_LABEL } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function GstIngestPage({
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

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
      <Link
        href={`/contractors/${id}`}
        className="text-xs text-slate-400 transition hover:text-slate-600"
      >
        ← Back to report
      </Link>

      <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
        Add GST data
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {contractor.legalName} · {ENTITY_LABEL[contractor.entityType]}
      </p>
      <p className="mt-3 max-w-prose text-sm text-slate-600">
        On the{" "}
        <a
          href="https://services.gst.gov.in/services/searchtp"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
        >
          GST portal
        </a>
        , search this contractor&apos;s GSTIN, then copy the taxpayer details
        (and the return-filing table, if you open it) and paste below. The
        fields are shown for your confirmation before anything is recorded.
      </p>

      <div className="mt-6">
        <GstIngestForm contractorId={id} />
      </div>
    </main>
  );
}
