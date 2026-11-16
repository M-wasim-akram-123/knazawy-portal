-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'COUNT';

-- CreateEnum
CREATE TYPE "CountStatus" AS ENUM ('COUNTING', 'WAITING', 'POSTED');

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "status" "CountStatus" NOT NULL DEFAULT 'COUNTING',
    "counted_on" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" TEXT NOT NULL,
    "count_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "book_quantity" DECIMAL(14,4) NOT NULL,
    "counted_quantity" DECIMAL(14,4),
    "variance_cost" DECIMAL(14,2),

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "stock_layers" ADD COLUMN "count_line_id" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "count_id" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "count_line_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_organisation_id_number_key" ON "stock_counts"("organisation_id", "number");
CREATE INDEX "stock_counts_organisation_id_idx" ON "stock_counts"("organisation_id");
CREATE INDEX "stock_counts_location_id_idx" ON "stock_counts"("location_id");
CREATE UNIQUE INDEX "stock_counts_one_open_location" ON "stock_counts"("location_id") WHERE "status" IN ('COUNTING', 'WAITING');

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_lines_count_id_item_id_key" ON "stock_count_lines"("count_id", "item_id");
CREATE INDEX "stock_count_lines_count_id_idx" ON "stock_count_lines"("count_id");
CREATE INDEX "stock_count_lines_item_id_idx" ON "stock_count_lines"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_layers_count_line_id_key" ON "stock_layers"("count_line_id");
CREATE INDEX "stock_movements_count_id_idx" ON "stock_movements"("count_id");

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "stock_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_layers" ADD CONSTRAINT "stock_layers_count_line_id_fkey" FOREIGN KEY ("count_line_id") REFERENCES "stock_count_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "stock_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_count_line_id_fkey" FOREIGN KEY ("count_line_id") REFERENCES "stock_count_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
