CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"domain" text NOT NULL,
	"quantity" integer,
	"capabilities" jsonb NOT NULL,
	"source" text DEFAULT 'photo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_owner_nonempty" CHECK (length(btrim("inventory_items"."clerk_user_id")) > 0),
	CONSTRAINT "inventory_items_name_trimmed" CHECK ("inventory_items"."name" = btrim("inventory_items"."name") and length("inventory_items"."name") between 1 and 100),
	CONSTRAINT "inventory_items_domain_active" CHECK ("inventory_items"."domain" in ('kitchen', 'electronics', 'garage', 'bathroom')),
	CONSTRAINT "inventory_items_quantity_positive" CHECK ("inventory_items"."quantity" is null or "inventory_items"."quantity" > 0),
	CONSTRAINT "inventory_items_capabilities_array" CHECK (jsonb_typeof("inventory_items"."capabilities") = 'array' and jsonb_array_length("inventory_items"."capabilities") between 1 and 6),
	CONSTRAINT "inventory_items_source_photo" CHECK ("inventory_items"."source" = 'photo')
);
--> statement-breakpoint
CREATE INDEX "inventory_items_clerk_user_id_idx" ON "inventory_items" USING btree ("clerk_user_id");