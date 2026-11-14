-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "vehicle_note" TEXT,
    "received_by" TEXT,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "dispatched_at" TIMESTAMP(3),
    "dispatched_by_id" TEXT,
    "delivered_at" TIMESTAMP(3),
    "delivered_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_lines" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "ordered" INTEGER NOT NULL,
    "dispatched" INTEGER,
    "delivered" INTEGER,

    CONSTRAINT "delivery_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_request_id_key" ON "deliveries"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_number_key" ON "deliveries"("number");

-- CreateIndex
CREATE INDEX "deliveries_organisation_id_idx" ON "deliveries"("organisation_id");

-- CreateIndex
CREATE INDEX "delivery_lines_recipe_id_idx" ON "delivery_lines"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_lines_delivery_id_recipe_id_key" ON "delivery_lines"("delivery_id", "recipe_id");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_dispatched_by_id_fkey" FOREIGN KEY ("dispatched_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_delivered_by_id_fkey" FOREIGN KEY ("delivered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

