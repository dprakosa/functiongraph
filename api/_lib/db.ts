import { drizzle } from "drizzle-orm/neon-http";
import { capabilityEmbeddings, inventoryItems } from "./inventorySchema.js";

/**
 * One Neon HTTP client per process, shared by the inventory store and the
 * ALG-2 embedding cache. Re-created only if DATABASE_URL changes, which
 * matters for the isolated integration-test database.
 */

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("database unavailable");
    this.name = "DatabaseUnavailableError";
  }
}

let cachedUrl: string | null = null;
let cachedDatabase: ReturnType<typeof createDatabase> | null = null;

function createDatabase(url: string) {
  return drizzle(url, { schema: { inventoryItems, capabilityEmbeddings } });
}

export function database() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new DatabaseUnavailableError();
  if (!cachedDatabase || cachedUrl !== url) {
    cachedUrl = url;
    cachedDatabase = createDatabase(url);
  }
  return cachedDatabase;
}
