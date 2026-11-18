/* eslint-disable @typescript-eslint/no-explicit-any -- bản ghi thiết bị đến từ bộ màn danh mục chung. */
import { Activity, CircleDot, Lock, MapPin, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { EQUIPMENT_CONDITION_LABELS, OFF_BOOK_STATUSES } from "@/domains/equipment/types";


/**
 * "Sử dụng" của một tài sản dạng DẢI Ô NHỎ — dùng CHUNG cho màn chi tiết và màn Sửa để hai màn
 * đọc giống hệt nhau: vị trí · người quản lý · tình trạng · trạng thái · giá trị còn lại. Ô nào
 * phiếu quản có ổ khoá nhỏ (rê chuột ra phiếu đổi nó). Màn Sửa truyền `roomSlot` / `managerSlot`
 * — ô chọn cho XẾP CHỖ LẦN ĐẦU khi tài sản còn trống; màn chi tiết không truyền, ô trống hiện "—".
 */
export function UsageTiles({
  record,
  statusBadge,
  roomSlot,
  managerSlot,
}: {
  record: any;
  statusBadge: ReactNode;
  roomSlot?: ReactNode;
  managerSlot?: ReactNode;
}) {
  const tile = (icon: ReactNode, label: string, lockedBy: string | null, children: ReactNode, action?: ReactNode) => (
    <div className="bg-card shadow-e1 flex min-w-0 flex-col gap-1 rounded-xl border px-3.5 py-2.5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs [&_svg]:size-3.5">
        {icon}
        <span className="truncate">{label}</span>
        {lockedBy ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ms-auto cursor-help"><Lock /></span>
            </TooltipTrigger>
            <TooltipContent>Chỉ đổi qua {lockedBy}</TooltipContent>
          </Tooltip>
        ) : null}
        {action ? <span className={lockedBy ? "" : "ms-auto"}>{action}</span> : null}
      </div>
      <div className="min-w-0 text-sm font-medium">{children}</div>
    </div>
  );
  // Đã ra khỏi sổ thì không đổi chỗ được nữa. Đổi chỗ là PHIẾU: tài sản còn trong kho thì cấp phát,
  // đang ở một phòng thì điều chuyển nội bộ — mở đúng phiếu, kèm sẵn tài sản này.
  const gone = OFF_BOOK_STATUSES.includes(record?.status);
  const canEdit = record?._can?.write !== false && !gone;
  const moveTo = record?.status === "IN_STOCK"
    ? `/equipment-allocations/create?equipment.id=${record.id}`
    : `/equipment-allocations/create?kind=RELOCATE&equipment.id=${record?.id}`;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.35fr_1.35fr_1fr_1fr]">
      {tile(<MapPin />, "Vị trí", record.room ? "phiếu cấp phát / điều chuyển" : null,
        record.room ? <span className="block truncate">{record.room.name}</span> : (roomSlot ?? "—"),
        record.room && canEdit ? (
          <Link to={moveTo} className="text-primary font-medium hover:underline">Đổi</Link>
        ) : null)}
      {tile(<UserRound />, "Người quản lý", record.manager ? "phiếu cấp phát" : null,
        record.manager ? <span className="block truncate">{record.manager.name}</span> : (managerSlot ?? "—"))}
      {tile(<Activity />, "Tình trạng", "phiếu báo hỏng / sửa chữa / kiểm kê",
        EQUIPMENT_CONDITION_LABELS[record.condition] ?? "Chưa đánh giá")}
      {tile(<CircleDot />, "Trạng thái", "các phiếu nghiệp vụ", statusBadge ?? "—")}
    </div>
  );
}
