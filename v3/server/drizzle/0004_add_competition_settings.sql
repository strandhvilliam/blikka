ALTER TABLE "competitions" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "time_zone" text DEFAULT 'Europe/Stockholm' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_window_check" CHECK ("competitions"."closes_at" > "competitions"."opens_at");