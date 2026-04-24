CREATE TABLE `lint_entries` (
	`created_at` text NOT NULL,
	`description` text NOT NULL,
	`detector_version` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`proposed_form` text,
	`source_excerpt` text,
	`status` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lint_recurrences` (
	`entry_id` text NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note` text NOT NULL,
	`observed_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `lint_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lint_scan_runs` (
	`created_count` integer NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recurrence_count` integer NOT NULL,
	`scanned_at` text NOT NULL,
	`skipped_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memory_reflections` (
	`consolidated_content` text NOT NULL,
	`created_at` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`source_snapshot_ids` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memory_snapshots` (
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL
);
