CREATE TYPE "public"."receipt_match_source" AS ENUM('name', 'suggestion', 'none');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_kind" AS ENUM('image', 'text', 'unsupported');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_status" AS ENUM('pending', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TABLE "body_measurement_draft_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"kind" "body_measurement_kind" NOT NULL,
	"value" numeric(6, 2) NOT NULL,
	CONSTRAINT "body_measurement_draft_entries_value_positive_check" CHECK ("body_measurement_draft_entries"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "body_measurement_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"whatsapp_message_id" uuid,
	"measured_on" date NOT NULL,
	"warnings" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"inbox_item_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"extracted_name" varchar(160) NOT NULL,
	"product_id" uuid,
	"product_match" "receipt_match_source" NOT NULL,
	"package_count" numeric(10, 3),
	"total_content" numeric(12, 3),
	"paid_amount" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "inbox_receipt_lines_extracted_name_not_blank_check" CHECK (btrim("inbox_receipt_lines"."extracted_name") <> ''),
	CONSTRAINT "inbox_receipt_lines_package_count_positive_check" CHECK ("inbox_receipt_lines"."package_count" IS NULL OR "inbox_receipt_lines"."package_count" > 0),
	CONSTRAINT "inbox_receipt_lines_total_content_positive_check" CHECK ("inbox_receipt_lines"."total_content" IS NULL OR "inbox_receipt_lines"."total_content" > 0),
	CONSTRAINT "inbox_receipt_lines_paid_amount_positive_check" CHECK ("inbox_receipt_lines"."paid_amount" > 0),
	CONSTRAINT "inbox_receipt_lines_discount_nonnegative_check" CHECK ("inbox_receipt_lines"."discount_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inbox_receipts" (
	"inbox_item_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"whatsapp_message_id" uuid,
	"store_id" uuid,
	"store_match" "receipt_match_source" NOT NULL,
	"store_name" varchar(120),
	"store_branch" varchar(80),
	"store_neighborhood" varchar(120),
	"store_address" varchar(255),
	"payment_method" "payment_method",
	"items_amount" numeric(12, 2) NOT NULL,
	"total_mismatch" boolean DEFAULT false NOT NULL,
	"warnings" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_receipts_items_amount_nonnegative_check" CHECK ("inbox_receipts"."items_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"external_id" varchar(128) NOT NULL,
	"sender_number" varchar(20) NOT NULL,
	"kind" "whatsapp_message_kind" NOT NULL,
	"text" text,
	"media_mime_type" varchar(100),
	"media" "bytea",
	"received_at" timestamp with time zone NOT NULL,
	"status" "whatsapp_message_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(64),
	"reply_external_id" varchar(128),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_messages_attempts_nonnegative_check" CHECK ("whatsapp_messages"."attempts" >= 0),
	CONSTRAINT "whatsapp_messages_text_length_check" CHECK ("whatsapp_messages"."text" IS NULL OR char_length("whatsapp_messages"."text") <= 4000),
	CONSTRAINT "whatsapp_messages_media_size_check" CHECK ("whatsapp_messages"."media" IS NULL OR octet_length("whatsapp_messages"."media") <= 10485760)
);
--> statement-breakpoint
ALTER TABLE "body_measurement_draft_entries" ADD CONSTRAINT "body_measurement_draft_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurement_draft_entries" ADD CONSTRAINT "body_measurement_draft_entries_draft_id_body_measurement_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."body_measurement_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurement_drafts" ADD CONSTRAINT "body_measurement_drafts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurement_drafts" ADD CONSTRAINT "body_measurement_drafts_whatsapp_message_id_whatsapp_messages_id_fk" FOREIGN KEY ("whatsapp_message_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_receipt_lines" ADD CONSTRAINT "inbox_receipt_lines_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_receipt_lines" ADD CONSTRAINT "inbox_receipt_lines_inbox_item_id_inbox_receipts_inbox_item_id_fk" FOREIGN KEY ("inbox_item_id") REFERENCES "public"."inbox_receipts"("inbox_item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_receipt_lines" ADD CONSTRAINT "inbox_receipt_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_receipts" ADD CONSTRAINT "inbox_receipts_inbox_item_id_inbox_items_id_fk" FOREIGN KEY ("inbox_item_id") REFERENCES "public"."inbox_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_receipts" ADD CONSTRAINT "inbox_receipts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_receipts" ADD CONSTRAINT "inbox_receipts_whatsapp_message_id_whatsapp_messages_id_fk" FOREIGN KEY ("whatsapp_message_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_receipts" ADD CONSTRAINT "inbox_receipts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "body_measurement_draft_entries_draft_id_kind_unique" ON "body_measurement_draft_entries" USING btree ("draft_id","kind");--> statement-breakpoint
CREATE INDEX "body_measurement_drafts_user_id_created_at_idx" ON "body_measurement_drafts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "body_measurement_drafts_whatsapp_message_id_unique" ON "body_measurement_drafts" USING btree ("whatsapp_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_receipt_lines_inbox_item_id_position_unique" ON "inbox_receipt_lines" USING btree ("inbox_item_id","position");--> statement-breakpoint
CREATE INDEX "inbox_receipt_lines_product_id_idx" ON "inbox_receipt_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inbox_receipts_user_id_idx" ON "inbox_receipts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "inbox_receipts_whatsapp_message_id_idx" ON "inbox_receipts" USING btree ("whatsapp_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_user_id_external_id_unique" ON "whatsapp_messages" USING btree ("user_id","external_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_user_id_status_received_at_idx" ON "whatsapp_messages" USING btree ("user_id","status","received_at");