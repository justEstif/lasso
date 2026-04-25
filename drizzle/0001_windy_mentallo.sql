CREATE TABLE `observation_entries` (
	`category` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`observed_at` text NOT NULL,
	`priority` text NOT NULL,
	`snapshot_id` text NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `memory_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
