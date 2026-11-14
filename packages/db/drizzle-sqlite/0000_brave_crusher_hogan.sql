CREATE TABLE `absence` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`driver_id` text,
	`vehicle_id` text,
	`date_from` text NOT NULL,
	`date_to` text NOT NULL,
	`type` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`driver_id`) REFERENCES `driver`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `absence_org_range_idx` ON `absence` (`organisation_id`,`date_from`,`date_to`);--> statement-breakpoint
CREATE TABLE `assignment` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_version_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`vehicle_id` text NOT NULL,
	`status` text NOT NULL,
	`duty_group_id` text,
	`route_id` text,
	`extra_duty_route_id` text,
	`first_trip_minute` integer,
	`raw_code` text,
	`locked` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `plan_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`duty_group_id`) REFERENCES `duty_group`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`route_id`) REFERENCES `route`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`extra_duty_route_id`) REFERENCES `route`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_plan_day_vehicle_key` ON `assignment` (`plan_version_id`,`day_index`,`vehicle_id`);--> statement-breakpoint
CREATE INDEX `assignment_plan_group_idx` ON `assignment` (`plan_version_id`,`duty_group_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`payload` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `app_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_org_created_idx` ON `audit_log` (`organisation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `block_trip` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_version_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`vehicle_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`sequence` integer NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `plan_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trip`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `block_trip_plan_trip_key` ON `block_trip` (`plan_version_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `block_trip_plan_vehicle_idx` ON `block_trip` (`plan_version_id`,`day_index`,`vehicle_id`);--> statement-breakpoint
CREATE TABLE `cell_note` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_version_id` text NOT NULL,
	`day_index` integer,
	`vehicle_id` text,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `plan_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `defect_report` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`driver_id` text,
	`severity` text DEFAULT 'medium' NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reported_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`driver_id`) REFERENCES `driver`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `defect_report_org_status_idx` ON `defect_report` (`organisation_id`,`status`);--> statement-breakpoint
CREATE TABLE `depot` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `depot_org_code_key` ON `depot` (`organisation_id`,`code`);--> statement-breakpoint
CREATE TABLE `driver` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`employee_no` text NOT NULL,
	`full_name` text NOT NULL,
	`licence_class` text DEFAULT 'D' NOT NULL,
	`seniority` integer DEFAULT 0 NOT NULL,
	`home_depot_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`home_depot_id`) REFERENCES `depot`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `driver_org_employee_key` ON `driver` (`organisation_id`,`employee_no`);--> statement-breakpoint
CREATE TABLE `duty_group` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`vehicle_count` integer NOT NULL,
	`reference_day_index` integer NOT NULL,
	`default_route_id` text,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`default_route_id`) REFERENCES `route`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duty_group_org_code_key` ON `duty_group` (`organisation_id`,`code`);--> statement-breakpoint
CREATE TABLE `organisation` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`country_code` text DEFAULT 'TR' NOT NULL,
	`time_zone` text DEFAULT 'Europe/Istanbul' NOT NULL,
	`rotation_anchor_week` text DEFAULT '2026-09-21' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organisation_slug_key` ON `organisation` (`slug`);--> statement-breakpoint
CREATE TABLE `plan_version` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`week_start` text NOT NULL,
	`week_offset` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`reported_weekly_vehicle_days` integer,
	`note` text,
	`published_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `app_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_version_org_week_key` ON `plan_version` (`organisation_id`,`week_start`);--> statement-breakpoint
CREATE INDEX `plan_version_org_status_idx` ON `plan_version` (`organisation_id`,`status`);--> statement-breakpoint
CREATE TABLE `roster_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_version_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`driver_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`driving_minutes` integer DEFAULT 0 NOT NULL,
	`break_minutes` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `plan_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`driver_id`) REFERENCES `driver`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roster_entry_plan_day_driver_key` ON `roster_entry` (`plan_version_id`,`day_index`,`driver_id`);--> statement-breakpoint
CREATE INDEX `roster_entry_plan_vehicle_idx` ON `roster_entry` (`plan_version_id`,`day_index`,`vehicle_id`);--> statement-breakpoint
CREATE TABLE `route_stop` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`stop_id` text NOT NULL,
	`direction` integer DEFAULT 0 NOT NULL,
	`sequence` integer NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `route`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`stop_id`) REFERENCES `stop`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `route_stop_key` ON `route_stop` (`route_id`,`direction`,`sequence`);--> statement-breakpoint
CREATE TABLE `route` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`required_low_floor` integer DEFAULT false NOT NULL,
	`required_ac` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `route_org_code_key` ON `route` (`organisation_id`,`code`);--> statement-breakpoint
CREATE TABLE `rule_violation` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_version_id` text NOT NULL,
	`code` text NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`day_index` integer,
	`vehicle_id` text,
	`driver_id` text,
	`duty_group_id` text,
	`detected_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `plan_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`driver_id`) REFERENCES `driver`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`duty_group_id`) REFERENCES `duty_group`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rule_violation_plan_code_idx` ON `rule_violation` (`plan_version_id`,`code`);--> statement-breakpoint
CREATE TABLE `standby` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_version_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`vehicle_id` text NOT NULL,
	`route_id` text,
	`raw_code` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `plan_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`route_id`) REFERENCES `route`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `standby_plan_vehicle_key` ON `standby` (`plan_version_id`,`vehicle_id`);--> statement-breakpoint
CREATE TABLE `stop` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`latitude` text,
	`longitude` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stop_org_code_key` ON `stop` (`organisation_id`,`code`);--> statement-breakpoint
CREATE TABLE `swap_request` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_version_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`from_driver_id` text NOT NULL,
	`to_driver_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text,
	`decided_by` text,
	`decided_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `plan_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_driver_id`) REFERENCES `driver`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_driver_id`) REFERENCES `driver`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`decided_by`) REFERENCES `app_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `swap_request_plan_status_idx` ON `swap_request` (`plan_version_id`,`status`);--> statement-breakpoint
CREATE TABLE `trip_stop_time` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`stop_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`arrival_minute` integer NOT NULL,
	`departure_minute` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trip`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`stop_id`) REFERENCES `stop`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_stop_time_key` ON `trip_stop_time` (`trip_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `trip` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`day_type` text NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`crosses_midnight` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `route`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trip_route_daytype_start_idx` ON `trip` (`route_id`,`day_type`,`start_minute`);--> statement-breakpoint
CREATE UNIQUE INDEX `trip_route_daytype_start_key` ON `trip` (`route_id`,`day_type`,`start_minute`);--> statement-breakpoint
CREATE TABLE `app_user` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`driver_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`driver_id`) REFERENCES `driver`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_user_email_key` ON `app_user` (`email`);--> statement-breakpoint
CREATE TABLE `vehicle` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`depot_id` text,
	`plate_number` text NOT NULL,
	`capacity` integer,
	`low_floor` integer DEFAULT false NOT NULL,
	`air_conditioned` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'printed' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depot_id`) REFERENCES `depot`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicle_org_plate_key` ON `vehicle` (`organisation_id`,`plate_number`);--> statement-breakpoint
CREATE INDEX `vehicle_org_status_idx` ON `vehicle` (`organisation_id`,`status`);