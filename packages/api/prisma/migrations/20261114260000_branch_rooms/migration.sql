-- Floors are in a branch. Room types and their prices stay shared.
ALTER TABLE "room_floors" ADD COLUMN "branch_id" TEXT;

UPDATE "room_floors" AS row
SET "branch_id" = branch."id"
FROM "branches" AS branch
WHERE branch."organisation_id" = row."organisation_id" AND branch."code" = 'MAIN';

ALTER TABLE "room_floors" ALTER COLUMN "branch_id" SET NOT NULL;

DROP INDEX "room_floors_organisation_id_name_key";
CREATE UNIQUE INDEX "room_floors_branch_id_name_key" ON "room_floors"("branch_id", "name");
CREATE INDEX "room_floors_branch_id_idx" ON "room_floors"("branch_id");

ALTER TABLE "room_floors" ADD CONSTRAINT "room_floors_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A room request is for one Karam branch. Existing requests sit on that branch.
ALTER TABLE "room_requests" ADD COLUMN "branch_id" TEXT;

UPDATE "room_requests" AS request
SET "branch_id" = branch."id"
FROM "branches" AS branch
JOIN "organisations" AS org ON org."id" = branch."organisation_id"
WHERE org."type" = 'KARAM' AND branch."code" = 'MAIN';

ALTER TABLE "room_requests" ALTER COLUMN "branch_id" SET NOT NULL;

CREATE INDEX "room_requests_branch_id_idx" ON "room_requests"("branch_id");

ALTER TABLE "room_requests" ADD CONSTRAINT "room_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
