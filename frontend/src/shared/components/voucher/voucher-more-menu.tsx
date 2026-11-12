import { useInvalidate } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, History, Loader2, Printer, RefreshCw, Settings, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { TuckedAction } from "@/shared/components/voucher/voucher-actions";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/**
 * Menu ⚙ của màn chi tiết một phiếu — chỗ của những việc ÍT DÙNG: quá trình duyệt, tải lại, và hai
 * việc nguy hiểm (Huỷ phiếu, Xoá). Hàng nút trên đầu trang chỉ còn việc chính của bước hiện tại. Hộp
 * hỏi lại của Huỷ / Xoá vẫn do `VoucherActions` mở: menu chỉ báo việc được chọn qua `onAction`.
 *
 * `children` là các mục riêng của loại phiếu, đứng đầu menu (vd. "Xem thiết bị đã ghi tăng").
 *
 * `timelineButton`: Quá trình duyệt thành nút biểu tượng riêng cạnh ⚙ thay vì một mục trong menu.
 * `printLabel` / `onPrint`: thêm mục In ("In phiếu"); `onPrint` thay cách in khi màn phải chuẩn bị trước (phiếu
 * ghi tăng chuyển sang dạng Văn bản rồi mới in).
 */
export function VoucherMoreMenu({
  resource,
  record,
  onTimeline,
  onAction,
  children,
  timelineButton = false,
  timelineLabel = "Quá trình duyệt",
  printLabel = null,
  onPrint,
}: {
  resource: string;
  record: { id: number | string; _actions?: string[] } | undefined;
  onTimeline: () => void;
  onAction: (action: TuckedAction) => void;
  children?: ReactNode;
  timelineButton?: boolean;
  timelineLabel?: string;
  printLabel?: string | null;
  onPrint?: () => void;
}) {
  const actions = record?._actions ?? [];
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();
  const [spin, setSpin] = useState(0);
  const [reloading, setReloading] = useState(false);
  const reload = async () => {
    if (!record) return;
    setReloading(true);
    try {
      await Promise.all([
        invalidate({ resource, id: record.id, invalidates: ["detail"] }),
        queryClient.invalidateQueries({ queryKey: ["voucher_events", resource, record.id] }),
        queryClient.invalidateQueries({ queryKey: ["attachments", resource, record.id] }),
      ]);
    } finally {
      setReloading(false);
    }
  };
  return (
    <>
      {timelineButton ? (
        // Chỉ biểu tượng, rê chuột hiện tên — cùng kiểu nút Lịch sử của hồ sơ thiết bị.
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label={timelineLabel} onClick={onTimeline}>
              <History />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{timelineLabel}</TooltipContent>
        </Tooltip>
      ) : null}
      <DropdownMenu onOpenChange={(o) => o && setSpin((n) => n + 1)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Thao tác khác">
                {reloading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Settings key={spin} className={cn(spin > 0 && "animate-[spin_0.6s_ease-in-out_1]")} />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Thao tác khác</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="min-w-56">
          {children}
          {timelineButton ? null : (
            <DropdownMenuItem onSelect={onTimeline}>
              <History />
              {timelineLabel}
            </DropdownMenuItem>
          )}
          {printLabel && record ? (
            // Chờ menu đóng hẳn rồi mới mở hộp in — in ngay thì menu còn nằm trên trang in.
            <DropdownMenuItem onSelect={() => setTimeout(onPrint ?? (() => window.print()), 200)}>
              <Printer />
              {printLabel}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => void reload()}>
            <RefreshCw />
            Tải lại
          </DropdownMenuItem>
          {actions.includes("cancel") || actions.includes("delete") ? <DropdownMenuSeparator /> : null}
          {actions.includes("cancel") ? (
            <DropdownMenuItem onSelect={() => onAction("cancel")}>
              <Ban />
              Huỷ phiếu
            </DropdownMenuItem>
          ) : null}
          {actions.includes("delete") ? (
            <DropdownMenuItem variant="destructive" onSelect={() => onAction("delete")}>
              <Trash2 />
              Xoá phiếu
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
