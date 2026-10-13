CREATE TABLE `knowledge_versions` (
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`revision` integer NOT NULL,
	`project` integer NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	`actor` text NOT NULL,
	PRIMARY KEY(`owner`, `id`, `revision`)
);
