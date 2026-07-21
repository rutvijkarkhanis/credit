import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazily initialised so a missing DATABASE_URL fails at query time, not import
 * time. That distinction matters: it lets a page catch the error and render a
 * "database not reachable" message instead of the whole route 500-ing before it
 * can run. The client is created once and reused thereafter.
 *
 * `prepare: false` is required for connection-pooled Postgres (Supabase/Neon
 * transaction pooler), which is how this runs on Vercel.
 */
type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let cached: DbClient | null = null;

function init(): DbClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = postgres(connectionString, { prepare: false });
  cached = drizzle(client, { schema });
  return cached;
}

export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const instance = cached ?? init();
    return Reflect.get(instance, prop, receiver);
  },
});

export { schema };
