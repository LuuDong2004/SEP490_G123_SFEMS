import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { useLiquid } from "@/shared/hooks/use-liquid";
import { TAB_ACTIVE, TAB_IDLE, TAB_ITEM, TAB_STRIP } from "@/shared/lib/tab-style";

/** Chú thích khi rê chuột lên một lựa chọn: đủ rộng cho một câu, không tràn màn hẹp. */
const TAB_HINT = "max-w-[min(32rem,90vw)] font-medium text-pretty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

export type SegmentedOption<V extends string> = {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
  /** Một câu nói mục này cho xem gì — hiện khi rê chuột, cùng kiểu với tab phân hệ. */
  hint?: ReactNode;
};

/**
 * Nút chọn một trong vài chế độ (Tổng hợp / Theo kho/phòng / Theo tài sản; Làm việc / Văn bản…). Nền của mục đang
 * chọn là MỘT viên trượt kiểu chất lỏng sang mục mới (`useLiquid`, cùng chuyển động với thanh tab phân hệ); bấm vào
 * nút thì nút lún nhẹ — người dùng thấy ngay lần bấm đã ăn.
 *
 * - `brand`: viên màu chính (chế độ xem của danh sách).
 * - `card`: viên trắng nổi, chữ màu chính (công tắc nhỏ trên đầu phiếu).
 */
export function Segmented<V extends string>({ options, value, onChange, label, variant = "brand", size = "md", className }: {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Tên của cả nhóm cho trình đọc màn hình, vd. "Chế độ xem". */
  label: string;
  variant?: "brand" | "card";
  size?: "sm" | "md";
  className?: string;
}) {
  // Đổi chế độ xem thường dựng lại cả khối chứa nút (bảng khác, thanh công cụ khác): nhớ chỗ cũ theo màn + nhóm để
  // viên nền vẫn trượt từ mục cũ sang.
  const { pathname } = useLocation();
  const [boxRef, indRef] = useLiquid<HTMLDivElement>(value, { selector: '[aria-selected="true"]', memory: `seg:${pathname}:${label}` });
  return (
    <div ref={boxRef} role="tablist" aria-label={label}
      className={cn(TAB_STRIP, "shrink-0 gap-0.5 p-0.5", className)}>
      <span ref={indRef} aria-hidden
        className={cn("pointer-events-none absolute rounded-full opacity-0",
          variant === "brand"
            ? "pill-on"
            : "bg-card shadow-e1")} />
      {options.map((o) => {
        const active = o.value === value;
        const button = (
          <button key={o.value} type="button" role="tab" aria-selected={active}
            onClick={() => { if (!active) onChange(o.value); }}
            className={cn(
              TAB_ITEM,
              // Nút chọn nằm trong THANH CÔNG CỤ, cạnh ô tìm / nút lọc — cỡ gọn hơn thanh tab điều hướng (theo trưởng nhóm):
              // `md` nút 30px, cả khung (viền + đệm) 36px bằng ô tìm và nút "Bộ lọc" (h-9); `sm` 28px cho ô lọc nhỏ.
              size === "md" ? "h-[30px] gap-1.5 px-3.5" : "h-7 gap-1.5 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
              active
                ? (variant === "brand" ? TAB_ACTIVE : "text-primary delay-75")
                : TAB_IDLE,
            )}>
            {o.icon}
            {o.label}
          </button>
        );
        if (!o.hint) return button;
        return (
          <Tooltip key={o.value} delayDuration={300}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4} className={TAB_HINT}>{o.hint}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
