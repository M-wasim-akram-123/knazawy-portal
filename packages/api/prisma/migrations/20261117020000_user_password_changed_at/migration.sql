-- A new password signs the person out everywhere: tokens issued before this time are refused.
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMP(3);
