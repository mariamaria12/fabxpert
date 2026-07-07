interface ActivityDotProps {
  color: string | null;
}

export function ActivityDot({ color }: ActivityDotProps) {
  return (
    <span
      className="activity-dot"
      style={{ background: color ?? 'var(--color-border-subtle)' }}
      aria-hidden="true"
    />
  );
}
