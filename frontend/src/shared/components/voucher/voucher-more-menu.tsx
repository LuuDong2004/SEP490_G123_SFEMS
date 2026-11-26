import { useInvalidate } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, History, Loader2, Printer, RefreshCw, Settings, Trash2, XCircle } from "lucide-react";
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
 * Nút biểu tượng Quá trình duyệt (cạnh ⚙) và menu ⚙ của màn chi tiết một phiếu — chỗ của những việc ÍT DÙNG: tải lại, và hai việc
 * nguy hiểm (Huỷ phiếu, Xoá). Hàng nút trên đầu trang chỉ còn việc chính của bước hiện tại (Sửa, Trình,
 * Duyệt…). Hộp hỏi lại của Huỷ / Xoá vẫn do `VoucherActions` mở: menu chỉ báo việc được chọn qua
 * `onAction`, màn truyền lại cho `VoucherActions` bằng prop `tucked`.
 *
 * <p>`children` là các mục riêng của loại phiếu, đứng đầu menu (vd. "Xem tài sản đã ghi tăng").
 *
 * <p>IN cũng ở đây, cho mọi phiếu: `printLabel` đổi chữ ("In biên bản"), `onPrint` thay cách in khi màn phải
 * chuẩn bị trước (phiếu ghi tăng chuyển sang dạng Văn bản rồi mới in). Truyền `printLabel={null}` để bỏ.
 */
export function VoucherMoreMenu({ resource, record, onTimeline, onAction, children, printLabel = "In phiếu", onPrint, timelineLabel = "Quá trình duyệt" }: {
  /** Tên mục mở quá trình — phiếu không qua duyệt đặt tên khác. */
  timelineLabel?: string;
  printLabel?: string | null;
  onPrint?: () => void;
  resource: string;
  record: { id: number | string; _actions?: string[]; returnNote?: string | null } | undefined;
  onTimeline: () => void;
  onAction: (action: TuckedAction) => void;
  children?: ReactNode;
}) {
  // Phiếu bị trả về: nút Huỷ phiếu đã ở hàng nút ngoài (`VoucherActions`), menu không lặp lại.
  const actions = (record?._actions ?? []).filter((a) => !(a === "cancel" && record?.returnNote));
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
        queryClient.invalidateQueries({ queryKey: ["attachments", resource, record.id] }),
      ]);
    } finally {
      setReloading(false);
    }
  };
  return (
    <>
      {/* Chỉ biểu tượng, rê chuột hiện tên — cùng kiểu nút Lịch sử của hồ sơ thiết bị. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" aria-label={timelineLabel} onClick={onTimeline}>
            <History />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{timelineLabel}</TooltipContent>
      </Tooltip>
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
          {actions.includes("cancel") || actions.includes("delete") || actions.includes("reject") ? <DropdownMenuSeparator /> : null}
          {actions.includes("reject") ? (
            <DropdownMenuItem variant="destructive" onSelect={() => onAction("reject")}>
              <XCircle />
              Từ chối
            </DropdownMenuItem>
          ) : null}
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
