CREATE TYPE "public"."product_content_unit" AS ENUM('gram', 'milliliter', 'unit');--> statement-breakpoint
CREATE TABLE "product_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"name_key" varchar(220) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_aliases_name_not_blank_check" CHECK (btrim("product_aliases"."name") <> '')
);--> statement-breakpoint
CREATE TABLE "product_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"extracted_name" varchar(160),
	"package_count" numeric(10, 3),
	"total_content" numeric(12, 3) NOT NULL,
	"paid_amount" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_purchases_extracted_name_not_blank_check" CHECK ("product_purchases"."extracted_name" IS NULL OR btrim("product_purchases"."extracted_name") <> ''),
	CONSTRAINT "product_purchases_package_count_positive_check" CHECK ("product_purchases"."package_count" IS NULL OR "product_purchases"."package_count" > 0),
	CONSTRAINT "product_purchases_total_content_positive_check" CHECK ("product_purchases"."total_content" > 0),
	CONSTRAINT "product_purchases_paid_amount_positive_check" CHECK ("product_purchases"."paid_amount" > 0),
	CONSTRAINT "product_purchases_discount_nonnegative_check" CHECK ("product_purchases"."discount_amount" >= 0)
);--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"name_key" varchar(180) NOT NULL,
	"category_id" uuid,
	"content_unit" "product_content_unit" DEFAULT 'unit' NOT NULL,
	"package_content" numeric(12, 3),
	"energy_kcal" numeric(8, 2),
	"protein_g" numeric(8, 2),
	"carbohydrate_g" numeric(8, 2),
	"added_sugar_g" numeric(8, 2),
	"fat_g" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_name_not_blank_check" CHECK (btrim("products"."name") <> ''),
	CONSTRAINT "products_package_content_positive_check" CHECK ("products"."package_content" IS NULL OR "products"."package_content" > 0),
	CONSTRAINT "products_nutrition_nonnegative_check" CHECK (coalesce("products"."energy_kcal", 0) >= 0 AND coalesce("products"."protein_g", 0) >= 0 AND coalesce("products"."carbohydrate_g", 0) >= 0 AND coalesce("products"."added_sugar_g", 0) >= 0 AND coalesce("products"."fat_g", 0) >= 0)
);--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"branch" varchar(80),
	"neighborhood" varchar(120),
	"address" varchar(255),
	"name_key" varchar(220) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_name_not_blank_check" CHECK (btrim("stores"."name") <> '')
);--> statement-breakpoint
CREATE UNIQUE INDEX "product_aliases_user_id_name_key_unique" ON "product_aliases" USING btree ("user_id","name_key");--> statement-breakpoint
CREATE INDEX "product_aliases_product_id_idx" ON "product_aliases" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_purchases_user_id_product_id_idx" ON "product_purchases" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "product_purchases_transaction_id_idx" ON "product_purchases" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "product_purchases_store_id_idx" ON "product_purchases" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_user_id_name_key_unique" ON "products" USING btree ("user_id","name_key");--> statement-breakpoint
CREATE UNIQUE INDEX "products_id_user_id_unique" ON "products" USING btree ("id","user_id");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id") WHERE "products"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "stores_user_id_name_key_unique" ON "stores" USING btree ("user_id","name_key");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_id_user_id_unique" ON "stores" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_product_id_user_id_products_fk" FOREIGN KEY ("product_id","user_id") REFERENCES "public"."products"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_purchases" ADD CONSTRAINT "product_purchases_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_purchases" ADD CONSTRAINT "product_purchases_transaction_id_user_id_transactions_fk" FOREIGN KEY ("transaction_id","user_id") REFERENCES "public"."transactions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_purchases" ADD CONSTRAINT "product_purchases_product_id_user_id_products_fk" FOREIGN KEY ("product_id","user_id") REFERENCES "public"."products"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_purchases" ADD CONSTRAINT "product_purchases_store_id_user_id_stores_fk" FOREIGN KEY ("store_id","user_id") REFERENCES "public"."stores"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
