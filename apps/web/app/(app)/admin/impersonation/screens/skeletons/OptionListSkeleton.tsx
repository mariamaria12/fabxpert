interface ProjectListSkeletonProps {
  count?: number;
  label?: string;
}

interface ActivityListSkeletonProps {
  count?: number;
  label?: string;
}

export function TodayTotalBannerSkeleton() {
  return (
    <div
      className="today-total-banner today-total-banner-skeleton"
      aria-hidden="true"
    >
      <div className="today-total-banner-main">
        <span className="skeleton-block skeleton-banner-icon" />
        <span className="skeleton-block skeleton-banner-text" />
      </div>
      <span className="today-total-banner-eye">
        <span className="skeleton-block skeleton-banner-eye-icon" />
      </span>
    </div>
  );
}

export function ProjectListSkeleton({
  count = 3,
  label = 'Se încarcă proiectele',
}: ProjectListSkeletonProps) {
  return (
    <ul
      className="option-list option-list-skeleton"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <div className="option-row option-row-skeleton">
            <span className="skeleton-block skeleton-color-bar skeleton-color-bar-project" />
            <span className="option-row-body">
              <span className="skeleton-block skeleton-line skeleton-line-title" />
              <span className="skeleton-block skeleton-line skeleton-line-subtitle" />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ActivityListSkeleton({
  count = 5,
  label = 'Se încarcă activitățile',
}: ActivityListSkeletonProps) {
  return (
    <ul
      className="option-list option-list-skeleton option-list-skeleton-activities"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <div className="option-row option-row-activity option-row-skeleton">
            <span className="skeleton-block skeleton-dot" />
            <span className="option-row-body">
              <span className="skeleton-block skeleton-line skeleton-line-title" />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
