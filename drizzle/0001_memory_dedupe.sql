ALTER TABLE `memory_snapshots` ADD `fingerprint` text;--> statement-breakpoint
ALTER TABLE `memory_snapshots` ADD `last_seen_at` text;--> statement-breakpoint
ALTER TABLE `memory_snapshots` ADD `normalized_hash` text;--> statement-breakpoint
ALTER TABLE `memory_snapshots` ADD `seen_count` integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `memory_snapshots` ADD `superseded_by` text;
