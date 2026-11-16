-- CreateEnum
CREATE TYPE "RateCardStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateTable
CREATE TABLE "rate_cards" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "RateCardStatus" NOT NULL DEFAULT 'DRAFT',
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_card_lines" (
    "id" TEXT NOT NULL,
    "rate_card_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "minimum_quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_card_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rate_cards_number_key" ON "rate_cards"("number");

-- CreateIndex
CREATE INDEX "rate_cards_organisation_id_status_idx" ON "rate_cards"("organisation_id", "status");

-- CreateIndex
CREATE INDEX "rate_card_lines_recipe_id_idx" ON "rate_card_lines"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_card_lines_rate_card_id_recipe_id_key" ON "rate_card_lines"("rate_card_id", "recipe_id");

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_card_lines" ADD CONSTRAINT "rate_card_lines_rate_card_id_fkey" FOREIGN KEY ("rate_card_id") REFERENCES "rate_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_card_lines" ADD CONSTRAINT "rate_card_lines_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

