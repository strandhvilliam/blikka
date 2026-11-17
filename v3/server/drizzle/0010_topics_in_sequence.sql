ALTER TABLE "participants" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "topics_in_sequence" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "minutes_per_topic" integer;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_minutes_per_topic_check" CHECK ("competitions"."minutes_per_topic" is null or ("competitions"."topics_in_sequence" and "competitions"."minutes_per_topic" between 1 and 1440));