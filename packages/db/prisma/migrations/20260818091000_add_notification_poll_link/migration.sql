-- Links a POLL notification back to its poll, so answering (or closing the poll)
-- can clear exactly the right nudge instead of matching on the message text.

ALTER TABLE "notifications" ADD COLUMN "pollId" TEXT;

CREATE INDEX "notifications_pollId_idx" ON "notifications"("pollId");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_pollId_fkey"
    FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
