import { useCan, useList, type CrudFilter, type CrudSort } from "@refinedev/core";
import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Skeleton } from "@/shared/ui/skeleton";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STEP = 5;

/**
 * Một khối gọn trong hồ sơ phòng / khối nhà / cơ sở (cả trang lẫn hộp xem nhanh): tiêu đề + số đếm + một nút
 * ở đầu, rồi danh sách mỗi dòng hai tầng chữ — không ô tìm, không bảng nhiều cột. Hộp xem nhanh hẹp; một bảng
 * sáu cột với ô tìm trong đó là cả một màn danh sách nhét vào hộp thoại, còn chưa có gì thì chiếm nửa hộp.
 * Đọc {@value STEP} dòng, "Xem thêm" đọc tiếp.
 */
export function CompactSection({ title, resource, filters, sorters, row, onOpen, action, emptyText, step = STEP }: {
  title: string;
  resource: string;
  filters: CrudFilter[];
  sorters?: CrudSort[];
  /** Một dòng: chữ chính, dòng phụ mờ, và (nếu có) giá trị bên phải. */
  row: (record: any) => { title: ReactNode; meta?: ReactNode; aside?: ReactNode };
  onOpen?: (record: any) => void;
  /** Nút ở đầu khối (vd. "Ghi sửa chữa") — đã tự gác quyền ở chỗ gọi. */
  action?: ReactNode;
  emptyText: string;
  /** Số dòng đọc mỗi lần (mặc định {@value STEP}). */
  step?: number;
}) {
  const mayRead = useCan({ resource, action: "list" }).data?.can ?? false;
  const [limit, setLimit] = useState(step);
  const { result, query } = useList<any>({
    resource,
    filters,
    sorters,
    pagination: { currentPage: 1, pageSize: limit },
    queryOptions: { enabled: mayRead },
  });
  if (!mayRead) return null;
  const rows = result?.data ?? [];
  const total = result?.total ?? rows.length;

  return (
    <section className="space-y-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 className="text-overline text-muted-foreground">
          {title}
          {total ? <span className="text-foreground ms-1.5">{total}</span> : null}
        </h3>
        {action}
      </div>
      {query.isLoading ? (
        <Skeleton className="h-14 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2.5 text-sm">{emptyText}</p>
      ) : (
        <div className="divide-y overflow-hidden rounded-lg border">
          {rows.map((r) => {
            const v = row(r);
            return (
              <button key={r.id} type="button" onClick={() => onOpen?.(r)} disabled={!onOpen}
                className="hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2 text-start transition-colors disabled:cursor-default">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.title}</p>
                  {v.meta ? <p className="text-muted-foreground truncate text-xs">{v.meta}</p> : null}
                </div>
                {v.aside ? <div className="shrink-0 text-sm tabular-nums">{v.aside}</div> : null}
                {onOpen ? <ChevronRight className="text-muted-foreground size-4 shrink-0" /> : null}
              </button>
            );
          })}
          {total > rows.length ? (
            <button type="button" onClick={() => setLimit((l) => l + step * 2)}
              className="text-primary hover:bg-muted/50 w-full px-3 py-2 text-center text-xs font-medium">
              Xem thêm · còn {total - rows.length}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
