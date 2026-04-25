CREATE TABLE `lint_observation_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`last_observed_tokens` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
