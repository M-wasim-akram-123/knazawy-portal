-- CreateEnum
CREATE TYPE "DeliveryPoint" AS ENUM ('GATE', 'LOUNGE', 'AIRCRAFT', 'HOTEL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'IN_PRODUCTION', 'DISPATCHED', 'DELIVERED', 'INVOICED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "flight_number" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "service_date" DATE NOT NULL,
    "delivery_time" VARCHAR(5) NOT NULL,
    "delivery_point" "DeliveryPoint" NOT NULL,
    "delivery_detail" TEXT,
    "adults" INTEGER NOT NULL DEFAULT 0,
    "children" INTEGER NOT NULL DEFAULT 0,
    "infants" INTEGER NOT NULL DEFAULT 0,
    "crew" INTEGER NOT NULL DEFAULT 0,
    "special_diets" INTEGER NOT NULL DEFAULT 0,
    "special_diet_note" TEXT,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "decided_by_id" TEXT,
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_lines" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "service_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_number_key" ON "service_requests"("number");

-- CreateIndex
CREATE INDEX "service_requests_organisation_id_idx" ON "service_requests"("organisation_id");

-- CreateIndex
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");

-- CreateIndex
CREATE INDEX "service_request_lines_request_id_idx" ON "service_request_lines"("request_id");

-- CreateIndex
CREATE INDEX "service_request_lines_recipe_id_idx" ON "service_request_lines"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_request_lines_request_id_recipe_id_key" ON "service_request_lines"("request_id", "recipe_id");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_lines" ADD CONSTRAINT "service_request_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_lines" ADD CONSTRAINT "service_request_lines_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
