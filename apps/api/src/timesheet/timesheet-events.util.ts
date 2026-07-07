import type { TimesheetEventPayload } from './timesheet-events.service';

type PersonNameParts = {
  firstName: string;
  lastName: string;
};

export function personDisplayName(person: PersonNameParts): string {
  return `${person.firstName} ${person.lastName}`;
}

export function createdTimesheetEvent(
  id: string,
  person: PersonNameParts,
): TimesheetEventPayload {
  return {
    type: 'created',
    id,
    personName: personDisplayName(person),
  };
}

export function updatedTimesheetEvent(
  id: string,
  person: PersonNameParts,
): TimesheetEventPayload {
  return {
    type: 'updated',
    id,
    personName: personDisplayName(person),
  };
}

export function deletedTimesheetEvent(
  id: string,
  person: PersonNameParts,
): TimesheetEventPayload {
  return {
    type: 'deleted',
    id,
    personName: personDisplayName(person),
  };
}
