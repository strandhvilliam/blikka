ALTER TABLE "participants" DROP CONSTRAINT "participants_competition_id_reference_unique";--> statement-breakpoint
ALTER TABLE "participants" DROP COLUMN "reference";--> statement-breakpoint
ALTER TABLE "participants" DROP COLUMN "status";