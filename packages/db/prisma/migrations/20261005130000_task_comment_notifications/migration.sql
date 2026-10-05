-- A comment on a task now reaches the people on it: its assignee and its
-- author, whoever of them did not write the comment.

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_COMMENTED';
