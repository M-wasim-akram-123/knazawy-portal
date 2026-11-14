-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED');

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL DEFAULT 'INVOICE',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "request_id" TEXT NOT NULL,
    "rate_card_id" TEXT NOT NULL,
    "source_invoice_id" TEXT,
    "note" TEXT,
    "reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3),
    "issued_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "recipe_name" TEXT NOT NULL,
    "kind" "RecipeKind" NOT NULL,
    "delivered_quantity" INTEGER NOT NULL,
    "minimum_quantity" INTEGER NOT NULL,
    "billed_quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_organisation_id_status_idx" ON "invoices"("organisation_id", "status");

-- CreateIndex
CREATE INDEX "invoices_request_id_idx" ON "invoices"("request_id");

-- CreateIndex
CREATE INDEX "invoices_source_invoice_id_idx" ON "invoices"("source_invoice_id");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_lines_recipe_id_idx" ON "invoice_lines"("recipe_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rate_card_id_fkey" FOREIGN KEY ("rate_card_id") REFERENCES "rate_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_source_invoice_id_fkey" FOREIGN KEY ("source_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

