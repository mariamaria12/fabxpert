export interface PaginationProps {
  /** Current page, 1-indexed. */
  page: number;
  pageSize: number;
  /** Total row count across all pages. */
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  return (
    <div className="flex items-center justify-between gap-4 px-1 py-3 text-sm text-text-secondary">
      <span>{total} rezultate</span>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isFirstPage}
          onClick={() => onPageChange(page - 1)}
          aria-label="Pagina anterioară"
          className="flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted"
        >
          <i className="ti ti-chevron-left text-lg" aria-hidden="true" />
        </button>

        <span className="min-w-[8rem] text-center text-xs text-text-secondary">
          Pagina {page} din {totalPages}
        </span>

        <button
          type="button"
          disabled={isLastPage}
          onClick={() => onPageChange(page + 1)}
          aria-label="Pagina următoare"
          className="flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted"
        >
          <i className="ti ti-chevron-right text-lg" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
