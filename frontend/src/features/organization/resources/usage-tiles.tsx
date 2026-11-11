import { Activity, CircleDot, Lock, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { Badge } from "@/shared/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { ASSET_STATUS_LABELS, CONDITION_LABELS, type Equipment } from "@/domains/equipment/types";

/**
 * "Sử dụng" của một tài sản dạng dải ô nhỏ: vị trí · tình trạng · trạng thái — điều người
 * mở hồ sơ muốn biết ngay. Ô nào chỉ đổi được qua phiếu thì có ổ khoá nhỏ, rê chuột ra phiếu nào đổi nó.
 */
export function UsageTiles({ record }: { record: Equipment }) {
  const tile = (icon: ReactNode, label: string, lockedBy: string | null, children: ReactNode) => (
    <div className="bg-surface-subtle flex min-w-0 flex-col gap-1 rounded-lg border px-3 py-2.5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs [&_svg]:size-3.5">
        {icon}
        <span className="truncate">{label}</span>
        {lockedBy ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ms-auto cursor-help">
                <Lock />
              </span>
            </TooltipTrigger>
            <TooltipContent>Thay đổi qua {lockedBy}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="min-w-0 text-sm font-medium">{children}</div>
    </div>
  );

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {tile(
        <MapPin />,
        "Vị trí",
        "phiếu kiểm kê",
        record.room ? <span className="block truncate">{record.room.name}</span> : <span className="text-muted-foreground">Kho</span>,
      )}
      {tile(<Activity />, "Tình trạng", "phiếu kiểm kê", record.condition ? CONDITION_LABELS[record.condition] : "Chưa đánh giá")}
      {tile(
        <CircleDot />,
        "Trạng thái",
        "phiếu ghi tăng, kiểm kê",
        <Badge variant={ASSET_STATUS_VARIANTS[record.status] ?? "secondary"}>{ASSET_STATUS_LABELS[record.status]}</Badge>,
      )}
    </div>
  );
}
