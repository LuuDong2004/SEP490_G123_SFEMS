/* eslint-disable @typescript-eslint/no-explicit-any -- bản ghi thiết bị đến từ bộ màn danh mục chung. */
import { Activity, CircleDot, Lock, MapPin, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { EQUIPMENT_CONDITION_LABELS } from "@/domains/equipment/types";


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
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.35fr_1.35fr_1fr_1fr]">
      {tile(<MapPin />, "Vị trí", record.room ? "các phiếu nghiệp vụ" : null,
        record.room ? <span className="block truncate">{record.room.name}</span> : (roomSlot ?? <span className="text-muted-foreground font-normal">Chưa xếp chỗ</span>))}
      {tile(<UserRound />, "Người quản lý", record.manager ? "các phiếu nghiệp vụ" : null,
        record.manager ? <span className="block truncate">{record.manager.name}</span> : (managerSlot ?? <span className="text-muted-foreground font-normal">Chưa giao</span>))}
      {tile(<Activity />, "Tình trạng", "các phiếu nghiệp vụ",
        EQUIPMENT_CONDITION_LABELS[record.condition] ?? "Chưa đánh giá")}
      {tile(<CircleDot />, "Trạng thái", "các phiếu nghiệp vụ", statusBadge ?? <span className="text-muted-foreground font-normal">Chưa có</span>)}
    </div>
  );
}
