CREATE TABLE "otp_sends" (
	"email" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp NOT NULL
);
