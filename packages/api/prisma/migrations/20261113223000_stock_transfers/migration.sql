-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_IN';

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('SENT', 'RECEIVED');

-- A transferred layer has no receipt line. Existing layers keep theirs.
ALTER TABLE "stock_layers" ALTER COLUMN "receipt_line_id" DROP NOT NULL;
ALTER TABLE "stock_layers" ADD COLUMN "transfer_draw_id" TEXT;

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "from_location_id" TEXT NOT NULL,
    "to_location_id" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'SENT',
    "sent_on" DATE NOT NULL,
    "received_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity_base" DECIMAL(14,4) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_draws" (
    "id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "quantity_base" DECIMAL(14,4) NOT NULL,
    "unit_cost" DECIMAL(14,4) NOT NULL,
    "received_on" DATE NOT NULL,

    CONSTRAINT "stock_transfer_draws_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN "transfer_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_organisation_id_number_key" ON "stock_transfers"("organisation_id", "number");

-- CreateIndex
CREATE INDEX "stock_transfers_organisation_id_idx" ON "stock_transfers"("organisation_id");

-- CreateIndex
CREATE INDEX "stock_transfer_lines_transfer_id_idx" ON "stock_transfer_lines"("transfer_id");

-- CreateIndex
CREATE INDEX "stock_transfer_lines_item_id_idx" ON "stock_transfer_lines"("item_id");

-- CreateIndex
CREATE INDEX "stock_transfer_draws_line_id_idx" ON "stock_transfer_draws"("line_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_layers_transfer_draw_id_key" ON "stock_layers"("transfer_draw_id");

-- CreateIndex
CREATE INDEX "stock_movements_transfer_id_idx" ON "stock_movements"("transfer_id");

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_draws" ADD CONSTRAINT "stock_transfer_draws_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "stock_transfer_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_layers" ADD CONSTRAINT "stock_layers_transfer_draw_id_fkey" FOREIGN KEY ("transfer_draw_id") REFERENCES "stock_transfer_draws"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
