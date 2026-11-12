CREATE TABLE "block_trip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"day_index" integer NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"sequence" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "block_trip" ADD CONSTRAINT "block_trip_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_trip" ADD CONSTRAINT "block_trip_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_trip" ADD CONSTRAINT "block_trip_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "block_trip_plan_trip_key" ON "block_trip" USING btree ("plan_version_id","trip_id");--> statement-breakpoint
CREATE INDEX "block_trip_plan_vehicle_idx" ON "block_trip" USING btree ("plan_version_id","day_index","vehicle_id");