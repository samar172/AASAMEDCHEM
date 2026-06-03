import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Single Drizzle client used across the app.
 *
 * We use the `postgres-js` driver because the SAME code path works for:
 *   - local development against a local Postgres instance, and
 *   - production on Vercel against Neon's POOLED connection string
 *     (host containing "-pooler"), which is built for serverless.
 *
 * The client is cached on `globalThis` to avoid exhausting connections during
 * Next.js hot-reload in development.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
}

const globalForDb = globalThis as unknown as {
  __pg?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__pg ??
  postgres(connectionString, {
    // Keep the pool small; Neon pooled endpoint multiplexes connections.
    max: 10,
    // Neon requires SSL; local Postgres typically does not. The connection
    // string's sslmode handles this, but we also honour it here.
    ssl: connectionString.includes("neon.tech") ? "require" : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pg = client;
}

export const db = drizzle(client, { schema });
export { schema };
