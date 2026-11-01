import { useInvalidate } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, History, Loader2, RefreshCw, Settings, Trash2 } from "lucide-react";
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
 */
export function VoucherMoreMenu({ resource, record, onTimeline, onAction, children }: {
  resource: string;
  record: { id: number | string; _actions?: string[] } | undefined;
  onTimeline: () => void;
  onAction: (action: TuckedAction) => void;
  children?: ReactNode;
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
      ]);
    } finally {
      setReloading(false);
    }
  };
  return (
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
        <DropdownMenuItem onSelect={onTimeline}>
          <History />
          Quá trình duyệt
        </DropdownMenuItem>
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
  );
}
