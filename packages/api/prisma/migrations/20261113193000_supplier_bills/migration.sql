-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN "supplier_id" TEXT;
ALTER TABLE "goods_receipts" ADD COLUMN "bill_number" TEXT;
ALTER TABLE "goods_receipts" ADD COLUMN "bill_total" DECIMAL(14,2);
ALTER TABLE "goods_receipts" ADD COLUMN "bill_tax" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "goods_receipts" ADD COLUMN "bill_discount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "goods_receipts" ADD COLUMN "bill_file_name" TEXT;
ALTER TABLE "goods_receipts" ADD COLUMN "bill_stored_as" TEXT;
ALTER TABLE "goods_receipts" ADD COLUMN "bill_content_type" TEXT;

UPDATE "goods_receipts" AS receipt
SET "supplier_id" = purchase."supplier_id"
FROM "purchases" AS purchase
WHERE receipt."purchase_id" = purchase."id";

ALTER TABLE "goods_receipts" ALTER COLUMN "supplier_id" SET NOT NULL;
ALTER TABLE "goods_receipts" ALTER COLUMN "purchase_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "goods_receipt_lines" ADD COLUMN "item_id" TEXT;

UPDATE "goods_receipt_lines" AS line
SET "item_id" = purchase_line."item_id"
FROM "purchase_lines" AS purchase_line
WHERE line."purchase_line_id" = purchase_line."id";

ALTER TABLE "goods_receipt_lines" ALTER COLUMN "item_id" SET NOT NULL;
ALTER TABLE "goods_receipt_lines" ALTER COLUMN "purchase_line_id" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('OPEN');

-- CreateTable
CREATE TABLE "supplier_payables" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goods_receipts_supplier_id_idx" ON "goods_receipts"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_bill_identity_key"
ON "goods_receipts" ("organisation_id", "supplier_id", lower("bill_number"), "bill_total")
WHERE "bill_number" IS NOT NULL AND "bill_total" IS NOT NULL;

-- CreateIndex
CREATE INDEX "goods_receipt_lines_item_id_idx" ON "goods_receipt_lines"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payables_receipt_id_key" ON "supplier_payables"("receipt_id");

-- CreateIndex
CREATE INDEX "supplier_payables_organisation_id_idx" ON "supplier_payables"("organisation_id");

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
