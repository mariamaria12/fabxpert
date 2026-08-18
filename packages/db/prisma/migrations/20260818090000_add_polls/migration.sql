-- Polls: an admin asks the team a question with custom options. Draft polls stay
-- invisible; publishing opens them for answers. Votes are attributed to the user
-- so admins can see who answered what.

-- The new notification kind is only added here, never used in this migration, so
-- it is safe inside the migration transaction.
ALTER TYPE "NotificationKind" ADD VALUE 'POLL';

CREATE TYPE "PollStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "status" "PollStatus" NOT NULL DEFAULT 'DRAFT',
    "closesAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "poll_options" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "pollId" TEXT NOT NULL,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "poll_votes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "polls_deletedAt_status_publishedAt_idx" ON "polls"("deletedAt", "status", "publishedAt");
CREATE INDEX "poll_options_pollId_position_idx" ON "poll_options"("pollId", "position");
CREATE INDEX "poll_votes_pollId_userId_idx" ON "poll_votes"("pollId", "userId");
CREATE UNIQUE INDEX "poll_votes_optionId_userId_key" ON "poll_votes"("optionId", "userId");

ALTER TABLE "polls" ADD CONSTRAINT "polls_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_pollId_fkey"
    FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey"
    FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_optionId_fkey"
    FOREIGN KEY ("optionId") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
