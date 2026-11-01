import { useCan, useList, type BaseRecord, type HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { Inbox } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Toggle } from "@/shared/ui/toggle";

/**
 * "Chờ tôi duyệt" — lọc danh sách phiếu còn đúng những phiếu đang đợi chính người đang xem duyệt, ở
 * đúng cấp của họ. Bộ lọc là `awaiting=me`, server tự tính "tôi" là ai. Nút mang SỐ phiếu đang chờ và
 * chỉ hiện với người có quyền duyệt loại phiếu này.
 */
export function AwaitingMeToggle<T extends BaseRecord>({
  table,
  resource,
}: {
  table: UseTableReturnType<T, HttpError>;
  resource: string;
}) {
  const { data: can } = useCan({ resource, action: "approve" });
  // Ghi qua `columnFilters` như ô tìm nhanh: `useTable` dựng lại bộ lọc lõi từ đó mỗi lần đổi.
  const { setColumnFilters, getState } = table.reactTable;
  const on = (getState().columnFilters as unknown as { id: string }[]).some((f) => f.id === "awaiting");
  const { result } = useList({
    resource,
    filters: [{ field: "awaiting", operator: "eq", value: "me" }],
    pagination: { currentPage: 1, pageSize: 1 },
    queryOptions: { enabled: !!can?.can },
  });
  const waiting = result?.total ?? 0;

  if (!can?.can) return null;

  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={on}
      title="Chỉ hiện phiếu đang đợi bạn duyệt"
      onPressedChange={(pressed) =>
        setColumnFilters((prev) => {
          const others = (prev as unknown as { id: string }[]).filter((f) => f.id !== "awaiting");
          return (pressed ? [...others, { id: "awaiting", operator: "eq", value: "me" }] : others) as ColumnFiltersState;
        })
      }
    >
      <Inbox />
      Chờ tôi duyệt
      <span className={cn("rounded-full px-1.5 text-xs tabular-nums", waiting ? "bg-warning-subtle text-warning-text font-semibold" : "text-muted-foreground")}>
        {waiting}
      </span>
    </Toggle>
  );
}
