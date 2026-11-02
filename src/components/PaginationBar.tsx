import { Pagination } from '@dhis2/ui'
import type { UsePaginationResult } from '../hooks/usePagination'

export function PaginationBar<T>({ pagination }: { pagination: UsePaginationResult<T> }) {
  if (pagination.total <= pagination.pageSize && pagination.page === 1) return null

  return (
    <div style={{ marginTop: 8 }}>
      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageCount={pagination.pageCount}
        total={pagination.total}
        onPageChange={pagination.onPageChange}
        onPageSizeChange={pagination.onPageSizeChange}
        pageSizes={['10', '20', '50', '100']}
      />
    </div>
  )
}
