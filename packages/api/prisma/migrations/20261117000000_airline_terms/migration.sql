-- Commercial terms agreed with each airline, copied onto an invoice when it is issued.
ALTER TABLE "organisations"
  ADD COLUMN "payment_terms_days" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "invoices"
  ADD COLUMN "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "payment_terms_days" INTEGER,
  ADD COLUMN "due_on" DATE;
