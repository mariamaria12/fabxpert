/** Fixed width for project name columns in data tables. */
export const PROJECT_NAME_COLUMN_WIDTH = '240px';

export const PROJECT_CODE_COLUMN_WIDTH = '200px';

export const PROJECT_CLIENT_COLUMN_WIDTH = '130px';

export function TruncatedTableCell({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={`block max-w-full truncate ${className}`.trim()} title={text}>
      {text}
    </span>
  );
}

export function ProjectNameCell({
  name,
  className = '',
}: {
  name: string;
  className?: string;
}) {
  return <TruncatedTableCell text={name} className={`font-medium ${className}`.trim()} />;
}

export const projectNameTableColumnLayout = {
  width: PROJECT_NAME_COLUMN_WIDTH,
  className: 'overflow-hidden',
} as const;

export const projectCodeTableColumnLayout = {
  width: PROJECT_CODE_COLUMN_WIDTH,
  className: 'overflow-hidden font-mono text-xs text-text-secondary',
} as const;

export const projectClientTableColumnLayout = {
  width: PROJECT_CLIENT_COLUMN_WIDTH,
  className: 'overflow-hidden text-text-secondary',
} as const;
