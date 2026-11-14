-- Locations and purchases belong to the branch that works with them.
ALTER TABLE "stock_locations" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "purchases" ADD COLUMN "branch_id" TEXT;

-- Today's stock sits on the branch the migration already created.
UPDATE "stock_locations" AS row
SET "branch_id" = branch."id"
FROM "branches" AS branch
WHERE branch."organisation_id" = row."organisation_id" AND branch."code" = 'MAIN';

UPDATE "purchases" AS row
SET "branch_id" = branch."id"
FROM "branches" AS branch
WHERE branch."organisation_id" = row."organisation_id" AND branch."code" = 'MAIN';

ALTER TABLE "stock_locations" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "purchases" ALTER COLUMN "branch_id" SET NOT NULL;

CREATE INDEX "stock_locations_branch_id_idx" ON "stock_locations"("branch_id");
CREATE INDEX "purchases_branch_id_idx" ON "purchases"("branch_id");

ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
