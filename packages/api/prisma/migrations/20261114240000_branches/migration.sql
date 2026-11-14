-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branches_organisation_id_idx" ON "branches"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_organisation_id_code_key" ON "branches"("organisation_id", "code");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Karam has one branch today. Each KARAM organisation gets one, named after it.
INSERT INTO "branches" ("id", "organisation_id", "code", "name", "active", "created_at", "updated_at")
SELECT 'branch_' || "id", "id", 'MAIN', "name", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organisations"
WHERE "type" = 'KARAM';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "branch_id" TEXT;

-- Karam staff work in that branch. Airline users have no branch.
UPDATE "users" AS u
SET "branch_id" = b."id"
FROM "branches" AS b
WHERE b."organisation_id" = u."organisation_id";

-- CreateIndex
CREATE INDEX "users_branch_id_idx" ON "users"("branch_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
