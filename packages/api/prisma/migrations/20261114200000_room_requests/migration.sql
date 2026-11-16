-- CreateEnum
CREATE TYPE "RoomRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "room_requests" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "RoomRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "party" TEXT,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "decided_by_id" TEXT,
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_request_lines" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "room_type_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "nightly_quoted" DECIMAL(12,2),

    CONSTRAINT "room_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_requests_number_key" ON "room_requests"("number");

-- CreateIndex
CREATE INDEX "room_requests_organisation_id_idx" ON "room_requests"("organisation_id");

-- CreateIndex
CREATE INDEX "room_requests_status_idx" ON "room_requests"("status");

-- CreateIndex
CREATE INDEX "room_request_lines_request_id_idx" ON "room_request_lines"("request_id");

-- CreateIndex
CREATE INDEX "room_request_lines_room_type_id_idx" ON "room_request_lines"("room_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_request_lines_request_id_room_type_id_key" ON "room_request_lines"("request_id", "room_type_id");

-- AddForeignKey
ALTER TABLE "room_requests" ADD CONSTRAINT "room_requests_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_requests" ADD CONSTRAINT "room_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_requests" ADD CONSTRAINT "room_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_request_lines" ADD CONSTRAINT "room_request_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "room_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_request_lines" ADD CONSTRAINT "room_request_lines_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
