CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`actor_user_id` text,
	`actor_email` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`detail` text,
	`ip` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_org_idx` ON `audit_log` (`org_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`plan_name` text NOT NULL,
	`term_start` text NOT NULL,
	`term_end` text NOT NULL,
	`billing_cycle` text DEFAULT 'annual' NOT NULL,
	`auto_renew` integer DEFAULT true NOT NULL,
	`notice_days` integer DEFAULT 30 NOT NULL,
	`committed_seats` integer DEFAULT 0 NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`overage_unit_price_cents` integer DEFAULT 0 NOT NULL,
	`platform_fee_cents` integer DEFAULT 0 NOT NULL,
	`annual_commit_cents` integer DEFAULT 0 NOT NULL,
	`uplift` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`owning_document_url` text,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contracts_vendor_idx` ON `contracts` (`vendor_id`);--> statement-breakpoint
CREATE INDEX `contracts_term_end_idx` ON `contracts` (`term_end`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`cost_center` text NOT NULL,
	`owner_user_id` text,
	`annual_budget_cents` integer DEFAULT 0 NOT NULL,
	`headcount` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `departments_org_idx` ON `departments` (`org_id`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`department_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` text NOT NULL,
	`offboarded_at` text,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `employees_org_idx` ON `employees` (`org_id`);--> statement-breakpoint
CREATE INDEX `employees_dept_idx` ON `employees` (`department_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`contract_id` text,
	`period_month` text NOT NULL,
	`base_cents` integer DEFAULT 0 NOT NULL,
	`overage_cents` integer DEFAULT 0 NOT NULL,
	`credits_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'paid' NOT NULL,
	`issued_at` text NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `invoices_vendor_idx` ON `invoices` (`vendor_id`);--> statement-breakpoint
CREATE INDEX `invoices_month_idx` ON `invoices` (`period_month`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_vendor_month_unique` ON `invoices` (`vendor_id`,`period_month`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`fiscal_year_start_month` integer DEFAULT 1 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `renewal_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`owner_user_id` text,
	`stage` text DEFAULT 'not_started' NOT NULL,
	`target_savings_cents` integer DEFAULT 0 NOT NULL,
	`due_at` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `renewal_contract_unique` ON `renewal_tasks` (`contract_id`);--> statement-breakpoint
CREATE TABLE `seat_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`tier` text DEFAULT 'Standard' NOT NULL,
	`assigned_at` text NOT NULL,
	`last_active_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`monthly_cost_cents` integer DEFAULT 0 NOT NULL,
	`reclaimed_at` text,
	`reclaimed_by_user_id` text,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reclaimed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seats_vendor_idx` ON `seat_assignments` (`vendor_id`);--> statement-breakpoint
CREATE INDEX `seats_employee_idx` ON `seat_assignments` (`employee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `seats_vendor_employee_unique` ON `seat_assignments` (`vendor_id`,`employee_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`user_agent` text,
	`ip` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `shadow_it_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`app_name` text NOT NULL,
	`category` text NOT NULL,
	`source` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`user_count` integer DEFAULT 0 NOT NULL,
	`monthly_spend_cents` integer DEFAULT 0 NOT NULL,
	`risk_score` integer DEFAULT 0 NOT NULL,
	`data_scopes` text,
	`status` text DEFAULT 'new' NOT NULL,
	`department_id` text,
	`overlaps_vendor_id` text,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`overlaps_vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shadow_org_idx` ON `shadow_it_findings` (`org_id`);--> statement-breakpoint
CREATE TABLE `usage_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`period_month` text NOT NULL,
	`provisioned_seats` integer DEFAULT 0 NOT NULL,
	`active_seats` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_vendor_month_unique` ON `usage_snapshots` (`vendor_id`,`period_month`);--> statement-breakpoint
CREATE INDEX `usage_month_idx` ON `usage_snapshots` (`period_month`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`role` text DEFAULT 'viewer' NOT NULL,
	`department_id` text,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` text,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`website` text NOT NULL,
	`accent_hue` integer DEFAULT 0 NOT NULL,
	`owner_user_id` text,
	`department_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`risk_tier` text DEFAULT 'low' NOT NULL,
	`data_classification` text DEFAULT 'internal' NOT NULL,
	`sso_enforced` integer DEFAULT false NOT NULL,
	`scim_enabled` integer DEFAULT false NOT NULL,
	`discovery_source` text DEFAULT 'finance' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `vendors_org_idx` ON `vendors` (`org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_org_name_unique` ON `vendors` (`org_id`,`name`);