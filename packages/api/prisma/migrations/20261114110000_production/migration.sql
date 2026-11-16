-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'PRODUCTION_USE';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN "production_batch_id" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "production_line_id" TEXT;

-- CreateTable
CREATE TABLE "production_batches" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "produced_on" DATE NOT NULL,
    "planned_portions" DECIMAL(14,3) NOT NULL,
    "actual_portions" DECIMAL(14,3) NOT NULL,
    "total_cost" DECIMAL(14,2) NOT NULL,
    "cost_per_portion" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_lines" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity_base" DECIMAL(14,4) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "production_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_batches_organisation_id_number_key" ON "production_batches"("organisation_id", "number");
CREATE INDEX "production_batches_organisation_id_idx" ON "production_batches"("organisation_id");
CREATE INDEX "production_batches_recipe_id_idx" ON "production_batches"("recipe_id");
CREATE INDEX "production_lines_batch_id_idx" ON "production_lines"("batch_id");
CREATE INDEX "production_lines_item_id_idx" ON "production_lines"("item_id");
CREATE INDEX "stock_movements_production_batch_id_idx" ON "stock_movements"("production_batch_id");

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_lines" ADD CONSTRAINT "production_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_lines" ADD CONSTRAINT "production_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_production_line_id_fkey" FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
