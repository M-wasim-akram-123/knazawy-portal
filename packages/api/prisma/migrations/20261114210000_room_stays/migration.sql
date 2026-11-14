-- CreateTable
CREATE TABLE "room_stays" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "request_line_id" TEXT NOT NULL,
    "hotel_room_id" TEXT NOT NULL,
    "checked_in_at" TIMESTAMP(3) NOT NULL,
    "checked_in_by_id" TEXT NOT NULL,
    "checked_out_at" TIMESTAMP(3),
    "checked_out_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_stays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_stays_organisation_id_idx" ON "room_stays"("organisation_id");

-- CreateIndex
CREATE INDEX "room_stays_request_line_id_idx" ON "room_stays"("request_line_id");

-- CreateIndex
CREATE INDEX "room_stays_hotel_room_id_checked_out_at_idx" ON "room_stays"("hotel_room_id", "checked_out_at");

-- AddForeignKey
ALTER TABLE "room_stays" ADD CONSTRAINT "room_stays_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_stays" ADD CONSTRAINT "room_stays_request_line_id_fkey" FOREIGN KEY ("request_line_id") REFERENCES "room_request_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_stays" ADD CONSTRAINT "room_stays_hotel_room_id_fkey" FOREIGN KEY ("hotel_room_id") REFERENCES "hotel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_stays" ADD CONSTRAINT "room_stays_checked_in_by_id_fkey" FOREIGN KEY ("checked_in_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_stays" ADD CONSTRAINT "room_stays_checked_out_by_id_fkey" FOREIGN KEY ("checked_out_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
