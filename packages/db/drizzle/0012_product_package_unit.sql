ALTER TYPE "public"."product_content_unit" RENAME VALUE 'unit' TO 'package';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "content_unit" SET DEFAULT 'package';--> statement-breakpoint
UPDATE "products" SET "package_content" = NULL WHERE "content_unit" = 'package';
