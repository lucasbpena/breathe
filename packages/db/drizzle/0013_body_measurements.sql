CREATE TYPE "public"."body_measurement_kind" AS ENUM('weight', 'neck', 'shoulders', 'chest', 'waist', 'abdomen', 'hips', 'leftArm', 'rightArm', 'leftForearm', 'rightForearm', 'leftThigh', 'rightThigh', 'leftCalf', 'rightCalf');--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "body_measurement_kind" NOT NULL,
	"value" numeric(6, 2) NOT NULL,
	"measured_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "body_measurements_value_positive_check" CHECK ("body_measurements"."value" > 0)
);
--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "body_measurements_user_id_kind_measured_on_unique" ON "body_measurements" USING btree ("user_id","kind","measured_on");