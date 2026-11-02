import { useEffect, useState } from 'react'

export interface UsePaginationResult<T> {
  pageItems: T[]
  page: number
  pageSize: number
  pageCount: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

// Client-side pagination over an already-fetched array -- every data table in this app
// (gateway history/preview, the old Sync tab's own history/preview) loads its full result
// set in one call already, so slicing in the browser is simpler and just as correct as
// asking the server to page it, and every table gets identical Prev/Next behaviour for free.
export function usePagination<T>(items: T[], initialPageSize = 20): UsePaginationResult<T> {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  // A fresh fetch/filter can shrink the list below the page you were on (e.g. switching
  // tabs, or a preview re-run with fewer rows) -- snap back to the last valid page instead
  // of silently showing an empty table.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const clampedPage = Math.min(page, pageCount)
  const start = (clampedPage - 1) * pageSize
  const pageItems = items.slice(start, start + pageSize)

  function onPageSizeChange(newSize: number) {
    setPageSize(newSize)
    setPage(1)
  }

  return { pageItems, page: clampedPage, pageSize, pageCount, total: items.length, onPageChange: setPage, onPageSizeChange }
}
