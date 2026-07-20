# credit

Contractor creditworthiness assessment built entirely on public-domain sources.

Produces an evidence-backed report on a contractor that a materials vendor can
use when deciding whether to extend payment terms.

## What this is, and what it deliberately is not

This is a **red-flag / exclusion engine**, not a credit score.

Public data is far better at establishing that a contractor is risky than at
confirming one is safe. Cancelled GST registration, lapsed PF contributions,
cheque-dishonour cases and debarment entries are all provable from the public
record. But the *absence* of adverse signals is not evidence of payment
discipline — a contractor who pays every supplier ninety days late leaves no
public trace until it becomes litigation.

So the report makes claims it can actually support:

> "Checked 9 of 11 applicable sources. No adverse signals found."

and avoids claims it cannot:

> ~~"Scores 780. Merits 45-day terms."~~

The first kills bad deals cheaply and is defensible line by line. The second is
how you eventually get embarrassed by a default you appeared to endorse.

A numeric score exists in the schema but is secondary, nullable, and omitted
when coverage is too thin to support one.

## Design principles

**No claim without provenance.** Every assertion is an `evidence` row pointing
back to the `check` that produced it, and every check retains the raw payload
the source returned. That payload is what proves what the portal actually said
on the date it was asked — the basis of the whole document's credibility.

**Coverage is reported, not hidden.** Most small contractors are
proprietorships with no registrar presence, so several sources are permanently
N/A for them. A report showing "6 of 11 applicable" tells the reader how much
ground was covered. Presenting thin coverage as a complete picture is the
failure mode this schema is built to prevent.

**Probable is not confirmed.** Court and blacklist records are name-matched, and
name matching is noisy — "Kumar Constructions" collides with many unrelated
entities. Flags carry `confidence` separately from `severity`, so a probable
match never produces an automatic adverse verdict. It surfaces for human
disambiguation instead.

**Methodology is versioned.** Assessments pin `methodologyVersion` so a report
issued today stays interpretable after the weights change.

**Consent-free by construction.** Every source in the registry is queryable
without the contractor's participation, which is what makes pre-screening
possible. Anything requiring consent — bureau reports, bank statements via
Account Aggregator, ITR — is out of scope and would need its own registry and
consent-capture path.

## Sources

Registry lives in [`src/db/sources.ts`](src/db/sources.ts), held as data rather
than code so coverage can be computed by joining against it.

**Tier 1 — behavioural, current, hard to fake.** GST registration profile and
return-filing cadence; EPFO contribution continuity; S.138 cheque-dishonour
cases; debt-recovery and SARFAESI action; IBBI/NCLT insolvency; suit-filed and
wilful-defaulter lists.

**Tier 2 — structural.** MCA company master data, registered charges, annual
filing currency, director disqualification; Udyam registration.

**Tier 3 — pipeline and reputation.** Government tender awards; debarment and
blacklist entries; RERA project registrations; external credit ratings.

Two sources deserve particular note. **GST filing cadence** is the best single
signal available — monthly, behavioural, no consent required. **EPFO
contribution continuity** is the earliest: a business under cash pressure stops
remitting PF before it stops paying suppliers.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Postgres via Drizzle · deployed
on Vercel at `credit.cunstruct.com`.

Source adapters are written against a provider-agnostic interface. Scraping MCA
and eCourts directly is brittle and rate-limited; the intended path is a KYC
aggregator (Perfios/Karza, Signzy, SurePass, IDfy, AuthBridge all cover
overlapping subsets), kept swappable.

## Setup

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL
npx drizzle-kit push           # apply schema
npm run dev
```

## Status

Early. Data model and source registry are in place; source adapters, scoring
and report generation are not yet built.

## Caveats

Portal availability shifts — verify each source is still publicly accessible
before relying on it; `isActive` is the kill switch.

Systematically producing credit assessments that lenders rely on can engage
regulatory questions in India (credit information companies fall under CICRA).
Where the line sits depends on positioning and distribution. Worth proper legal
advice before scaling.
