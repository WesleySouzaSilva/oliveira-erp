import { useState, useMemo, useCallback } from "react";

interface UsePaginationOptions {
  pageSize?: number;
}

export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { pageSize = 50 } = options;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const paginatedItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );

  const hasMore = visibleCount < items.length;
  const totalCount = items.length;
  const shownCount = paginatedItems.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + pageSize, items.length));
  }, [pageSize, items.length]);

  const reset = useCallback(() => {
    setVisibleCount(pageSize);
  }, [pageSize]);

  return {
    paginatedItems,
    hasMore,
    totalCount,
    shownCount,
    loadMore,
    reset,
  };
}
