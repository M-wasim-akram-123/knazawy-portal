-- AlterTable
ALTER TABLE "hotel_rooms" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "room_stays" ADD COLUMN "guests_male" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "guests_female" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "guests_children" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "check_out_time" TEXT NOT NULL DEFAULT '12:00';

-- CreateTable
CREATE TABLE "room_reservations" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "request_line_id" TEXT NOT NULL,
    "hotel_room_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_reservations_organisation_id_idx" ON "room_reservations"("organisation_id");

-- CreateIndex
CREATE INDEX "room_reservations_hotel_room_id_idx" ON "room_reservations"("hotel_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_reservations_request_line_id_hotel_room_id_key" ON "room_reservations"("request_line_id", "hotel_room_id");

-- AddForeignKey
ALTER TABLE "room_reservations" ADD CONSTRAINT "room_reservations_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_reservations" ADD CONSTRAINT "room_reservations_request_line_id_fkey" FOREIGN KEY ("request_line_id") REFERENCES "room_request_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_reservations" ADD CONSTRAINT "room_reservations_hotel_room_id_fkey" FOREIGN KEY ("hotel_room_id") REFERENCES "hotel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_reservations" ADD CONSTRAINT "room_reservations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
