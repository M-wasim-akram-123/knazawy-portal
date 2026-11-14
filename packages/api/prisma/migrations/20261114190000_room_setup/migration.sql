-- CreateTable
CREATE TABLE "room_floors" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_types" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_charges" (
    "id" TEXT NOT NULL,
    "room_type_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount_per_night" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_rooms" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "floor_id" TEXT NOT NULL,
    "room_type_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_floors_organisation_id_idx" ON "room_floors"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_floors_organisation_id_name_key" ON "room_floors"("organisation_id", "name");

-- CreateIndex
CREATE INDEX "room_types_organisation_id_idx" ON "room_types"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_types_organisation_id_name_key" ON "room_types"("organisation_id", "name");

-- CreateIndex
CREATE INDEX "room_charges_room_type_id_idx" ON "room_charges"("room_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_charges_room_type_id_name_key" ON "room_charges"("room_type_id", "name");

-- CreateIndex
CREATE INDEX "hotel_rooms_organisation_id_idx" ON "hotel_rooms"("organisation_id");

-- CreateIndex
CREATE INDEX "hotel_rooms_room_type_id_idx" ON "hotel_rooms"("room_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_rooms_floor_id_name_key" ON "hotel_rooms"("floor_id", "name");

-- AddForeignKey
ALTER TABLE "room_floors" ADD CONSTRAINT "room_floors_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_charges" ADD CONSTRAINT "room_charges_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rooms" ADD CONSTRAINT "hotel_rooms_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rooms" ADD CONSTRAINT "hotel_rooms_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "room_floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rooms" ADD CONSTRAINT "hotel_rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
