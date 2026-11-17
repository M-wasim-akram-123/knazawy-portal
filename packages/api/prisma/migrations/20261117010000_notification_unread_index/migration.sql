-- The bell counts unread notifications for one user on every page and every live ping.
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
