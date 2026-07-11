import { defineConfig } from "drizzle-kit";

const url =
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!url) {
  throw new Error(
    "DATABASE_URL_UNPOOLED or DATABASE_URL is required to run inventory migrations",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./api/_lib/inventorySchema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
