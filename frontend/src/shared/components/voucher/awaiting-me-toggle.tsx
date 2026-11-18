import { useCan, useList, type BaseRecord, type HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { ClipboardCheck } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Toggle } from "@/shared/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/**
 * "Chờ tôi duyệt" — lọc danh sách phiếu còn đúng những phiếu đang đợi chính
 * người đang xem duyệt, ở đúng cấp của họ.
 *
 * <p>Bộ lọc là {@code awaiting=me}, và server tự tính "tôi" là ai (trường nào,
 * cơ quan nào) — màn hình không gửi trường hay cơ quan lên, nên không ai chỉnh
 * query string để xem hàng đợi của người khác.
 *
 * <p>Nút mang SỐ phiếu đang chờ: một nút "Chờ tôi duyệt" trơn không nói có việc hay không, phải bấm
 * mới biết. Chỉ hiện với người có quyền duyệt loại phiếu này.
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

  // Nút biểu tượng tròn như hàng công cụ màn Thiết bị: số phiếu đang chờ thành chấm số ở góc.
  return (
    <Tooltip delayDuration={200}>
    <TooltipTrigger asChild>
    <Toggle
      variant="outline"
      pressed={on}
      aria-label="Chờ tôi duyệt"
      className={cn("relative size-9 shrink-0 rounded-full p-0", on && "border-primary/50 text-primary bg-primary/5")}
      onPressedChange={(pressed) =>
        setColumnFilters((prev) => {
          const others = (prev as unknown as { id: string }[]).filter((f) => f.id !== "awaiting");
          return (pressed ? [...others, { id: "awaiting", operator: "eq", value: "me" }] : others) as ColumnFiltersState;
        })
      }
    >
      <ClipboardCheck />
      {waiting ? (
        <span className="bg-warning text-warning-foreground ring-background absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold tabular-nums ring-2">
          {waiting}
        </span>
      ) : null}
    </Toggle>
    </TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={4} tone="light" className="font-medium">
      Chờ tôi duyệt · {waiting ? `${waiting} phiếu` : "không có phiếu nào"}
    </TooltipContent>
    </Tooltip>
  );
}
