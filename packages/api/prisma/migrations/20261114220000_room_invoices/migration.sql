-- CreateEnum
CREATE TYPE "RoomInvoiceKind" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- CreateTable
CREATE TABLE "room_invoices" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "RoomInvoiceKind" NOT NULL,
    "room_request_id" TEXT NOT NULL,
    "source_invoice_id" TEXT,
    "reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "room_type_id" TEXT NOT NULL,
    "room_type_name" TEXT NOT NULL,
    "rooms" INTEGER NOT NULL,
    "nights" INTEGER NOT NULL,
    "nightly" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "room_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_invoices_number_key" ON "room_invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "room_invoices_room_request_id_kind_key" ON "room_invoices"("room_request_id", "kind");

-- CreateIndex
CREATE INDEX "room_invoices_organisation_id_idx" ON "room_invoices"("organisation_id");

-- CreateIndex
CREATE INDEX "room_invoice_lines_invoice_id_idx" ON "room_invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "room_invoice_lines_room_type_id_idx" ON "room_invoice_lines"("room_type_id");

-- AddForeignKey
ALTER TABLE "room_invoices" ADD CONSTRAINT "room_invoices_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invoices" ADD CONSTRAINT "room_invoices_room_request_id_fkey" FOREIGN KEY ("room_request_id") REFERENCES "room_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invoices" ADD CONSTRAINT "room_invoices_source_invoice_id_fkey" FOREIGN KEY ("source_invoice_id") REFERENCES "room_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invoices" ADD CONSTRAINT "room_invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invoice_lines" ADD CONSTRAINT "room_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "room_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invoice_lines" ADD CONSTRAINT "room_invoice_lines_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
