-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'ISSUE';

-- CreateEnum
CREATE TYPE "StockIssueReason" AS ENUM ('KITCHEN_USE', 'WASTAGE', 'SPOILAGE', 'DAMAGE');

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "receipt_line_id" DROP NOT NULL;
ALTER TABLE "stock_movements" ADD COLUMN "issue_id" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "issue_line_id" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "unit_cost" DECIMAL(14,4) NOT NULL DEFAULT 0;

UPDATE "stock_movements" AS movement
SET "unit_cost" = layer."unit_cost"
FROM "stock_layers" AS layer
WHERE movement."layer_id" = layer."id";

ALTER TABLE "stock_movements" ALTER COLUMN "unit_cost" DROP DEFAULT;

-- CreateTable
CREATE TABLE "stock_issues" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "issued_on" DATE NOT NULL,
    "reason" "StockIssueReason" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_issue_lines" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity_base" DECIMAL(14,4) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "stock_issue_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_issues_organisation_id_number_key" ON "stock_issues"("organisation_id", "number");

-- CreateIndex
CREATE INDEX "stock_issues_organisation_id_idx" ON "stock_issues"("organisation_id");

-- CreateIndex
CREATE INDEX "stock_issue_lines_issue_id_idx" ON "stock_issue_lines"("issue_id");

-- CreateIndex
CREATE INDEX "stock_issue_lines_item_id_idx" ON "stock_issue_lines"("item_id");

-- CreateIndex
CREATE INDEX "stock_movements_issue_id_idx" ON "stock_movements"("issue_id");

-- CreateIndex
CREATE INDEX "stock_movements_issue_line_id_idx" ON "stock_movements"("issue_line_id");

-- AddForeignKey
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_issue_lines" ADD CONSTRAINT "stock_issue_lines_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "stock_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_issue_lines" ADD CONSTRAINT "stock_issue_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "stock_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_issue_line_id_fkey" FOREIGN KEY ("issue_line_id") REFERENCES "stock_issue_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
