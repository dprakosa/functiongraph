import { execFileSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const TEST_DATABASE_NAME = "functiongraph_test";

function databaseUrl(name) {
  const source =
    process.env.TEST_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!source) {
    throw new Error(
      "No database URL found. Run this through `vercel env run -e development -- npm run test:db` or set TEST_DATABASE_URL.",
    );
  }
  const url = new URL(source);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("The test database source must be a PostgreSQL URL.");
  }
  url.pathname = `/${name}`;
  return url.toString();
}

async function ensureTestDatabase() {
  const testUrl = databaseUrl(TEST_DATABASE_NAME);
  if (process.env.TEST_DATABASE_URL?.trim()) return testUrl;

  const adminUrl =
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim();
  const sql = neon(adminUrl);
  const existing = await sql.query(
    "select 1 from pg_database where datname = $1",
    [TEST_DATABASE_NAME],
  );
  if (existing.length === 0) {
    // The identifier is an application constant, never user input.
    await sql.query(`create database ${TEST_DATABASE_NAME}`);
  }
  return testUrl;
}

const testUrl = await ensureTestDatabase();
await migrate(drizzle(testUrl), { migrationsFolder: "drizzle" });

console.log(`Migrated isolated database ${TEST_DATABASE_NAME}; running integration tests.`);
execFileSync(
  "npm",
  [
    "test",
    "--",
    "api/_lib/inventoryStore.integration.test.ts",
    "api/_lib/embeddingCache.integration.test.ts",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: testUrl,
      TEST_DATABASE_URL: testUrl,
    },
  },
);
