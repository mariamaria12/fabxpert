'use client';

import { PollsSection } from './PollsSection';

interface CommunicationTabProps {
  active: boolean;
}

/** Everything the company sends to the team. Polls for now; announcements later. */
export function CommunicationTab({ active }: CommunicationTabProps) {
  return <PollsSection active={active} />;
}
