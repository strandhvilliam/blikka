ALTER TABLE "participants" DROP CONSTRAINT "participants_competition_id_email_unique";--> statement-breakpoint
DROP INDEX "participants_competition_id_user_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "participants_competition_id_email_unique" ON "participants" USING btree ("competition_id","email") WHERE "participants"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "participants_competition_id_user_id_unique" ON "participants" USING btree ("competition_id","user_id") WHERE "participants"."user_id" is not null and "participants"."deleted_at" is null;