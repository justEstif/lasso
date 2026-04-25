ALTER TABLE `lint_entries` ADD `affected_paths` text;--> statement-breakpoint
ALTER TABLE `lint_entries` ADD `category` text;--> statement-breakpoint
ALTER TABLE `lint_entries` ADD `referenced_date` text;--> statement-breakpoint
ALTER TABLE `lint_entries` ADD `relative_offset` integer;--> statement-breakpoint
ALTER TABLE `lint_entries` ADD `severity` text;--> statement-breakpoint
ALTER TABLE `lint_recurrences` ADD `referenced_date` text;--> statement-breakpoint
ALTER TABLE `lint_recurrences` ADD `relative_offset` integer;