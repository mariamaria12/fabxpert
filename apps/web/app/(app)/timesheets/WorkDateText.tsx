import { formatRomanianDate, SPECIAL_WORK_DAYS, specialWorkDay } from './timesheetFormat';

/**
 * A pontaj date. Saturdays, public holidays and Sundays get their own colour,
 * with the reason on hover — colour alone says nothing to someone who cannot
 * see it.
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

/** What the colours of `WorkDateText` mean, for under a list that uses it. */
export function WorkDateLegend({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted ${className}`}>
      {Object.values(SPECIAL_WORK_DAYS).map((day) => (
        <li key={day.label} className="inline-flex items-center gap-1.5">
          <span className={`${day.className} text-[10px] leading-none`} aria-hidden="true">
            ●
          </span>
          <span className={`${day.className} font-medium`}>{day.label}</span>
        </li>
      ))}
    </ul>
  );
}
