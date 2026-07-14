interface MobileErrorScreenProps {
  message?: string;
  onRetry: () => void;
}

/** Full-area connection/load error with retry — used instead of a blank screen. */
export function MobileErrorScreen({
  message = 'Nu s-a putut contacta serverul.',
  onRetry,
}: MobileErrorScreenProps) {
  return (
    <div className="mobile-error-screen">
      <p className="flow-error-text">{message}</p>
      <button type="button" className="flow-retry-button" onClick={onRetry}>
        Reîncearcă
      </button>
    </div>
  );
}
