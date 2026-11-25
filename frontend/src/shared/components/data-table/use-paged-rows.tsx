import { useEffect, useRef, useState, type ReactNode } from "react";

import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";

/** Cỡ trang nhỏ nhất của ô chọn: từng này dòng trở xuống thì không có gì để lật. */
const SMALLEST_PAGE = 10;

/**
 * Chia trang một danh sách đã tải đủ về trình duyệt (danh sách lấy theo trang từ máy chủ thì dùng `DataTable`).
 *
 * - `resetKey`: đổi ô tìm, bộ lọc thì về trang đầu.
 * - `boxRef`: gắn vào khung cuộn của bảng, lật trang là về đầu khung.
 * - `pager`: thanh lật trang, đặt NGOÀI khung cuộn. Danh sách ngắn thì không có.
 */
export function usePagedRows<T>(rows: T[], { resetKey = "", sizeKey, pageSizeLabel }: {
  resetKey?: string;
  /** Khoá nhớ số dòng mỗi trang của màn này. */
  sizeKey: string;
  pageSizeLabel?: string;
}) {
  const [page, setPage] = useState(1);
  const [size, setSize] = usePersistentState<number>(`${sizeKey}.pageSize`, 20, "local");
  useEffect(() => setPage(1), [resetKey, size]);
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pageCount);
  const boxRef = useRef<HTMLDivElement>(null);
  // Có ngoặc nhọn: trình duyệt mới cho `scrollTo` trả về Promise, effect không được trả về thứ đó.
  useEffect(() => {
    boxRef.current?.scrollTo({ top: 0 });
  }, [current]);
  const pager: ReactNode = rows.length > SMALLEST_PAGE ? (
    <div className="shrink-0 border-t px-3 py-1.5" data-print="hide">
      <DataTablePagination currentPage={current} pageCount={pageCount} setCurrentPage={setPage} pageSize={size} setPageSize={setSize}
        total={rows.length} pageSizeLabel={pageSizeLabel} />
    </div>
  ) : null;
  return { visible: rows.slice((current - 1) * size, current * size), pager, boxRef };
}
