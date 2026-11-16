-- A credited room bill is no longer the bill in force, so the stay can be billed again.
ALTER TABLE "room_invoices" ADD COLUMN "open_request_id" TEXT;

UPDATE "room_invoices" AS bill
SET "open_request_id" = bill."room_request_id"
WHERE bill."kind" = 'INVOICE'
  AND NOT EXISTS (
    SELECT 1 FROM "room_invoices" AS credit
    WHERE credit."source_invoice_id" = bill."id"
  );

CREATE UNIQUE INDEX "room_invoices_open_request_id_key" ON "room_invoices"("open_request_id");

DROP INDEX "room_invoices_room_request_id_kind_key";

CREATE UNIQUE INDEX "room_invoices_source_invoice_id_key" ON "room_invoices"("source_invoice_id");

CREATE INDEX "room_invoices_room_request_id_idx" ON "room_invoices"("room_request_id");

-- A dispute covers one meal invoice or one room bill.
ALTER TABLE "disputes" ALTER COLUMN "invoice_id" DROP NOT NULL;

ALTER TABLE "disputes" ADD COLUMN "room_invoice_id" TEXT;

CREATE UNIQUE INDEX "disputes_room_invoice_id_key" ON "disputes"("room_invoice_id");

ALTER TABLE "disputes" ADD CONSTRAINT "disputes_room_invoice_id_fkey" FOREIGN KEY ("room_invoice_id") REFERENCES "room_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
