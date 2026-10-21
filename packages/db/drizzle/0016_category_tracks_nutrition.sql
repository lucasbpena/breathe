ALTER TABLE "categories" ADD COLUMN "tracks_nutrition" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_nutrition_expense_check" CHECK (NOT "categories"."tracks_nutrition" OR "categories"."type" = 'expense');--> statement-breakpoint
-- Food categories from the default set, and any category whose products already declare nutrition.
UPDATE "categories" SET "tracks_nutrition" = true
WHERE "type" = 'expense' AND NOT "is_system" AND (
	"name" IN ('Alimentação', 'Mercado', 'Restaurantes', 'Delivery')
	OR "id" IN (
		SELECT "category_id" FROM "products"
		WHERE "category_id" IS NOT NULL AND (
			"energy_kcal" IS NOT NULL OR "protein_g" IS NOT NULL OR "carbohydrate_g" IS NOT NULL
			OR "added_sugar_g" IS NOT NULL OR "fat_g" IS NOT NULL
		)
	)
);--> statement-breakpoint
-- Subcategories follow their parent.
UPDATE "categories" AS "child" SET "tracks_nutrition" = true
FROM "categories" AS "parent"
WHERE "child"."parent_id" = "parent"."id" AND "parent"."tracks_nutrition" AND "child"."type" = 'expense';
