CREATE TABLE `working_memory` (
	`content` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text,
	`thread_id` text,
	`updated_at` text NOT NULL
);
