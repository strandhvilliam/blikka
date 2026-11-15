CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"competition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topics_competition_id_idx" ON "topics" USING btree ("competition_id");