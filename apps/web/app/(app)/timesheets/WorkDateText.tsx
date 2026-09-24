import { formatRomanianDate, specialWorkDay } from './timesheetFormat';

/**
 * A pontaj date. Saturdays and public holidays get their own colour, with the
 * reason on hover — colour alone says nothing to someone who cannot see it.
 */
export function WorkDateText({ iso }: { iso: string }) {
  const special = specialWorkDay(iso);
  const date = formatRomanianDate(iso);

  if (!special) {
    return <>{date}</>;
  }

  return (
    <span className={`${special.className} font-medium`} title={special.label}>
      {date}
      <span className="sr-only"> ({special.label})</span>
    </span>
  );
}
