"use client";

import React from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

/**
 * Cụm thao tác của một hàng, gập sau nút "⋯".
 *
 * <p>Ba nút biểu tượng trên mỗi hàng chiếm một cột rộng được ghim bên phải, che mất
 * dữ liệu ở bảng hẹp. Gập lại thì cột chỉ còn một nút, và bấm vào mới hiện
 * "Xem / Sửa / Xoá" có chữ — rõ hơn ba biểu tượng phải rê chuột mới biết là gì.
 *
 * <p>Các nút bên trong vẫn là `EditButton` / `ShowButton` / `DeleteButton` như cũ:
 * chúng đọc `RowActionsContext` và tự vẽ thành một dòng menu, nên quyền
 * (`hideIfUnauthorized`), `_can` của từng hàng và hộp xác nhận xoá không đổi gì.
 *
 * <p>Popover chứ không phải DropdownMenu: DropdownMenu là modal và giành focus với
 * hộp xác nhận xoá. Và popover phải ĐỨNG YÊN khi hộp xác nhận đang mở — đóng nó
 * là gỡ luôn `DeleteButton`, kéo theo chính hộp thoại đang hỏi.
 */
type RowActionsValue = {
  /** Đóng menu — nút Sửa / Xem gọi sau khi bấm. */
  close: () => void;
  /** Giữ menu mở trong lúc một hộp thoại con (xác nhận xoá) đang mở. */
  hold: (held: boolean) => void;
};

const RowActionsContext = React.createContext<RowActionsValue | null>(null);

/** `null` ngoài menu; nút dùng nó để biết mình phải vẽ thành một dòng menu. */
export function useRowActionsMenu() {
  return React.useContext(RowActionsContext);
}

/** Lớp chung của một dòng trong menu thao tác. */
export const ROW_ACTION_ITEM = "h-8 w-full justify-start gap-2 px-2 pe-4 font-normal [&_svg]:size-4";

/** Bề rộng cột thao tác khi chỉ còn nút "⋯". */
export const ROW_ACTIONS_COLUMN = { size: 56, minSize: 56, maxSize: 56, enableResizing: false } as const;

export function RowActions({ children, label = "Thao tác" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const held = React.useRef(false);
  const value = React.useMemo<RowActionsValue>(
    () => ({
      close: () => setOpen(false),
      hold: (h) => {
        held.current = h;
        if (!h) setOpen(false);
      },
    }),
    [],
  );

  // Cuộn (bảng cuộn bên trong, hay cả trang) là đóng menu: menu bám theo nút "⋯", nên khi dòng trôi
  // ra khỏi khung bảng thì nó trôi theo, đè lên tiêu đề bảng và thanh header. Hộp xác nhận xoá đang
  // mở (`held`) thì giữ nguyên — đóng menu là gỡ luôn hộp thoại.
  React.useEffect(() => {
    if (!open) return;
    const onScroll = () => {
      if (!held.current) setOpen(false);
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [open]);

  return (
    <div className="flex justify-center">
      <Popover open={open} onOpenChange={(o) => (o || !held.current ? setOpen(o) : undefined)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={4} className="w-auto min-w-28 p-1">
          <RowActionsContext.Provider value={value}>
            <div className="flex flex-col">{children}</div>
          </RowActionsContext.Provider>
        </PopoverContent>
    </Popover>
    </div>
  );
}
