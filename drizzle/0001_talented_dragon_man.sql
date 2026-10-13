CREATE TABLE `members` (
	`workspace` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`projects` text NOT NULL,
	`active` integer NOT NULL,
	PRIMARY KEY(`workspace`, `email`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`workspace` text NOT NULL,
	`id` integer NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`workspace`, `id`)
);
--> statement-breakpoint
CREATE TABLE `task_versions` (
	`workspace` text NOT NULL,
	`id` text NOT NULL,
	`revision` integer NOT NULL,
	`project` integer NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	`actor` text NOT NULL,
	PRIMARY KEY(`workspace`, `id`, `revision`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL
);
