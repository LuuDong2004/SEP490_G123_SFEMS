import { useList, type BaseRecord, type HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { Toggle } from "@/shared/ui/toggle";

/** Một hàng đợi việc riêng của loại phiếu, vd. "Chờ trường mình nhận" của điều chuyển. */
export type WorkQueue = {
  /** Tên bộ lọc gửi lên máy chủ (`field=1`); máy chủ tự tính "mình" là ai. */
  field: string;
  label: string;
  icon: ReactNode;
  title: string;
};

/**
 * Nút lọc một hàng đợi việc, mang SỐ phiếu đang đợi — cùng kiểu "Chờ tôi duyệt". Chỉ hiện khi có việc hoặc đang bật:
 * người không bao giờ có việc ở hàng đợi này (Sở, trường không nhận gì) không phải thấy một nút số 0.
 */
export function WorkQueueToggle<T extends BaseRecord>({
  table,
  resource,
  queue,
}: {
  table: UseTableReturnType<T, HttpError>;
  resource: string;
  queue: WorkQueue;
}) {
  // Ghi qua `columnFilters` như ô tìm nhanh: `useTable` dựng lại bộ lọc lõi từ đó mỗi lần đổi.
  const { setColumnFilters, getState } = table.reactTable;
  const on = (getState().columnFilters as unknown as { id: string }[]).some((f) => f.id === queue.field);
  const { result } = useList({
    resource,
    filters: [{ field: queue.field, operator: "eq", value: "1" }],
    pagination: { currentPage: 1, pageSize: 1 },
  });
  const waiting = result?.total ?? 0;

  if (!waiting && !on) return null;

  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={on}
      title={queue.title}
      onPressedChange={(pressed) =>
        setColumnFilters((prev) => {
          const others = (prev as unknown as { id: string }[]).filter((f) => f.id !== queue.field);
          return (pressed ? [...others, { id: queue.field, operator: "eq", value: "1" }] : others) as ColumnFiltersState;
        })
      }
    >
      {queue.icon}
      {queue.label}
      <span className={cn("rounded-full px-1.5 text-xs tabular-nums", waiting ? "bg-warning-subtle text-warning-text font-semibold" : "text-muted-foreground")}>
        {waiting}
      </span>
    </Toggle>
  );
}
