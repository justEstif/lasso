CREATE TYPE "public"."lint_status" AS ENUM('proposed', 'accepted', 'rejected', 'deferred', 'implemented');--> statement-breakpoint
CREATE TYPE "public"."memory_scope" AS ENUM('resource', 'thread');--> statement-breakpoint
CREATE TYPE "public"."observation_priority" AS ENUM('high', 'low', 'medium');--> statement-breakpoint
CREATE TABLE "lint_entries" (
	"affected_paths" jsonb,
	"category" text,
	"created_at" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"detector_version" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"proposed_form" text,
	"referenced_date" timestamp with time zone,
	"relative_offset" integer,
	"severity" text,
	"source_excerpt" text,
	"status" "lint_status" NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lint_observation_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_observed_tokens" integer DEFAULT 0 NOT NULL,
	"last_observed_turns" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lint_recurrences" (
	"entry_id" text NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"note" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"referenced_date" timestamp with time zone,
	"relative_offset" integer
);
--> statement-breakpoint
CREATE TABLE "lint_scan_runs" (
	"created_count" integer NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"recurrence_count" integer NOT NULL,
	"scanned_at" timestamp with time zone NOT NULL,
	"skipped_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_observation_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_observed_tokens" integer DEFAULT 0 NOT NULL,
	"scope" "memory_scope" NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_reflections" (
	"consolidated_content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"source_snapshot_ids" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_snapshots" (
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"fingerprint" text,
	"id" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone,
	"normalized_hash" text,
	"scope" "memory_scope" NOT NULL,
	"seen_count" integer DEFAULT 1 NOT NULL,
	"superseded_by" text
);
--> statement-breakpoint
CREATE TABLE "observation_entries" (
	"category" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"priority" "observation_priority" NOT NULL,
	"referenced_date" timestamp with time zone,
	"relative_offset" integer,
	"snapshot_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_memory" (
	"content" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text,
	"thread_id" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lint_recurrences" ADD CONSTRAINT "lint_recurrences_entry_id_lint_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."lint_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_entries" ADD CONSTRAINT "observation_entries_snapshot_id_memory_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."memory_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lint_entries_active" ON "lint_entries" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_lint_entries_status_created" ON "lint_entries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_lint_recurrences_entry_id" ON "lint_recurrences" USING btree ("entry_id","observed_at");--> statement-breakpoint
CREATE INDEX "idx_lint_scan_runs_scanned_at" ON "lint_scan_runs" USING btree ("scanned_at");--> statement-breakpoint
CREATE INDEX "idx_memory_observation_state_scope" ON "memory_observation_state" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_memory_reflections_created_at" ON "memory_reflections" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_memory_snapshots_active" ON "memory_snapshots" USING btree ("last_seen_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_memory_snapshots_hash" ON "memory_snapshots" USING btree ("normalized_hash");--> statement-breakpoint
CREATE INDEX "idx_observation_entries_snapshot" ON "observation_entries" USING btree ("snapshot_id","observed_at");--> statement-breakpoint
CREATE INDEX "idx_observation_entries_priority" ON "observation_entries" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_working_memory_scope" ON "working_memory" USING btree ("resource_id","thread_id");