CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "capability_embeddings" (
	"model_revision" text NOT NULL,
	"name" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capability_embeddings_pk" PRIMARY KEY("model_revision","name")
);
