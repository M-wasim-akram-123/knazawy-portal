-- CreateEnum
CREATE TYPE "RecipeKind" AS ENUM ('MEAL', 'SNACK');

-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RecipeKind" NOT NULL,
    "portions" DECIMAL(14,3) NOT NULL,
    "wastage_percent" DECIMAL(5,2) NOT NULL,
    "status" "RecipeStatus" NOT NULL DEFAULT 'DRAFT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_lines" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity_per_portion" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipes_organisation_id_code_key" ON "recipes"("organisation_id", "code");
CREATE INDEX "recipes_organisation_id_idx" ON "recipes"("organisation_id");
CREATE UNIQUE INDEX "recipe_lines_recipe_id_item_id_key" ON "recipe_lines"("recipe_id", "item_id");
CREATE INDEX "recipe_lines_recipe_id_idx" ON "recipe_lines"("recipe_id");
CREATE INDEX "recipe_lines_item_id_idx" ON "recipe_lines"("item_id");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
