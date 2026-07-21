import { SOURCE_REGISTRY } from "../src/db/sources";

/**
 * Emits idempotent seed SQL for the source registry. Run with:
 *   npx tsx scripts/gen-seed.ts > drizzle/0001_seed_sources.sql
 * The registry in src/db/sources.ts is the single source of truth; this keeps
 * the seeded rows a mechanical projection of it rather than a hand-maintained
 * duplicate.
 */

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const nullable = (s?: string) => (s ? q(s) : "NULL");

const rows = SOURCE_REGISTRY.map((s) => {
  const arr = `ARRAY[${s.applicableEntityTypes.map(q).join(", ")}]::text[]`;
  return `  (${q(s.key)}, ${q(s.name)}, ${s.tier}, ${q(s.description)}, ${arr}, ${q(s.requiresIdentifier)}, ${nullable(s.provider)}, ${nullable(s.sourceUrl)}, ${s.isNameMatched ? "true" : "false"}, true)`;
});

const sql = `INSERT INTO sources (key, name, tier, description, applicable_entity_types, requires_identifier, provider, source_url, is_name_matched, is_active) VALUES
${rows.join(",\n")}
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  tier = EXCLUDED.tier,
  description = EXCLUDED.description,
  applicable_entity_types = EXCLUDED.applicable_entity_types,
  requires_identifier = EXCLUDED.requires_identifier,
  provider = EXCLUDED.provider,
  source_url = EXCLUDED.source_url,
  is_name_matched = EXCLUDED.is_name_matched,
  is_active = EXCLUDED.is_active;
`;

process.stdout.write(sql);
