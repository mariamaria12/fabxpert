export type PersonLike = {
  firstName: string;
  lastName: string;
};

/** Shrinks on phones so the name beside it gets the width instead. */
const avatarClassName =
  'flex size-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-raised text-[10px] font-medium text-accent md:size-8 md:text-xs';

export function formatPersonName(person: PersonLike): string {
  return `${person.firstName} ${person.lastName}`;
}

export function getPersonInitials(person: PersonLike): string {
  const first = person.firstName.trim()[0] ?? '';
  const last = person.lastName.trim()[0] ?? '';
  const initials = (first + last).toUpperCase();

  return initials || '?';
}

interface InitialsAvatarProps {
  initials: string;
}

export function InitialsAvatar({ initials }: InitialsAvatarProps) {
  return (
    <div className={avatarClassName} aria-hidden="true">
      {initials}
    </div>
  );
}

interface PersonAvatarProps {
  person: PersonLike;
}

export function PersonAvatar({ person }: PersonAvatarProps) {
  return <InitialsAvatar initials={getPersonInitials(person)} />;
}

interface PersonNameProps {
  person: PersonLike;
  className?: string;
  nameClassName?: string;
  uppercase?: boolean;
}

export function PersonName({
  person,
  className = '',
  nameClassName = '',
  uppercase = false,
}: PersonNameProps) {
  const name = formatPersonName(person);
  const displayName = uppercase ? name.toUpperCase() : name;

  return (
    <div className={`flex min-w-0 items-center gap-1.5 md:gap-3 ${className}`}>
      <PersonAvatar person={person} />
      <span className={`truncate ${nameClassName}`}>{displayName}</span>
    </div>
  );
}
