import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type {
  Capability,
  InventoryDomain,
} from "../../src/lib/types.js";

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    domain: text("domain").$type<InventoryDomain>().notNull(),
    quantity: integer("quantity"),
    capabilities: jsonb("capabilities").$type<Capability[]>().notNull(),
    source: text("source").$type<"photo">().default("photo").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("inventory_items_clerk_user_id_idx").on(table.clerkUserId),
    check(
      "inventory_items_owner_nonempty",
      sql`length(btrim(${table.clerkUserId})) > 0`,
    ),
    check(
      "inventory_items_name_trimmed",
      sql`${table.name} = btrim(${table.name}) and length(${table.name}) between 1 and 100`,
    ),
    check(
      "inventory_items_domain_active",
      sql`${table.domain} in ('kitchen', 'electronics', 'garage', 'bathroom')`,
    ),
    check(
      "inventory_items_quantity_positive",
      sql`${table.quantity} is null or ${table.quantity} > 0`,
    ),
    check(
      "inventory_items_capabilities_array",
      sql`jsonb_typeof(${table.capabilities}) = 'array' and jsonb_array_length(${table.capabilities}) between 1 and 6`,
    ),
    check("inventory_items_source_photo", sql`${table.source} = 'photo'`),
  ],
);

export type InventoryItemRow = typeof inventoryItems.$inferSelect;
