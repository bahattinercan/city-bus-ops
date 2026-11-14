CREATE TABLE "trip_stop_time" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"stop_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"arrival_minute" integer NOT NULL,
	"departure_minute" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_stop_time" ADD CONSTRAINT "trip_stop_time_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_stop_time" ADD CONSTRAINT "trip_stop_time_stop_id_stop_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_stop_time_key" ON "trip_stop_time" USING btree ("trip_id","sequence");